import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import path from 'node:path';
import { addAbortSignal, Readable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { diffManifests } from '../diff.js';
import { hashAsset, mapConcurrent } from '../hasher.js';
import { comparePaths } from '../scanner.js';
import type { AssetRecord, MigrationAction } from '../types.js';
import { LocalDeploymentStateStore, objectKey, validateDeploymentState } from './state.js';
import { StorageError, type DeploymentRecord, type DeploymentState, type DeploymentStateStore, type ExecutionReport,
  type MigrationResult, type RemoteAsset, type StorageAdapter } from './types.js';

export interface ExecuteMigrationOptions {
  root: string;
  adapter: StorageAdapter;
  stateStore?: DeploymentStateStore;
  concurrency?: number;
  /** Total attempts for each network operation, including the first. */
  maxAttempts?: number;
  retryDelayMs?: number;
  /** Explicitly permit replacing differing or unverified remote objects. */
  overwrite?: boolean;
  cacheControl?: string;
  signal?: AbortSignal;
  /** Called after an asset finishes. Observers must not throw. */
  onResult?: (result: MigrationResult) => void;
}

function matches(remote: RemoteAsset | null, asset: AssetRecord, cacheControl: string): boolean {
  return !!remote && remote.sha256 === asset.hash && remote.size === asset.size &&
    remote.mimeType === asset.mimeType && remote.cacheControl === cacheControl;
}

async function openAsset(root: string, asset: AssetRecord, signal?: AbortSignal): Promise<Readable> {
  signal?.throwIfAborted();
  const filename = path.resolve(root, ...asset.relativePath.split('/'));
  // Reject ancestor symlinks too; the canonical root itself may be a configured symlink.
  if (await realpath(filename) !== filename) throw new Error(`Asset path changed or contains a symlink: ${asset.relativePath}`);
  if (await hashAsset(filename, signal) !== asset.hash) throw new Error(`Asset differs from manifest: ${asset.relativePath}`);
  const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  let before;
  try {
    before = await handle.stat({ bigint: true });
    if (!before.isFile() || before.size !== BigInt(asset.size)) throw new Error(`Asset differs from manifest: ${asset.relativePath}`);
  } catch (error) { await handle.close(); throw error; }
  const hash = createHash('sha256');
  let size = 0;
  const source = handle.createReadStream({ autoClose: false });
  // Read lazily: do not emit stream errors while the SDK is still resolving credentials.
  const body = Readable.from((async function* () {
    for await (const chunk of source) {
      hash.update(chunk); size += chunk.length;
      yield chunk;
    }
    const after = await handle.stat({ bigint: true });
    if (size !== asset.size || hash.digest('hex') !== asset.hash || before.size !== after.size ||
        before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) {
      throw new Error(`Asset changed during upload: ${asset.relativePath}`);
    }
  })(), { objectMode: false });
  body.once('close', () => { source.destroy(); void handle.close().catch(() => {}); });
  if (signal) addAbortSignal(signal, body);
  return body;
}

/** Reconciles every nonremoved asset against the remote before doing any upload. */
export async function executeMigration(plan: readonly MigrationAction[], options: ExecuteMigrationOptions): Promise<ExecutionReport> {
  const concurrency = options.concurrency ?? 4;
  const maxAttempts = options.maxAttempts ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 200;
  const cacheControl = options.cacheControl ?? 'public, max-age=0, must-revalidate';
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || !Number.isSafeInteger(maxAttempts) || maxAttempts < 1 ||
      !Number.isFinite(retryDelayMs) || retryDelayMs < 0) throw new Error('Invalid execution concurrency or retry settings');
  // Validate untrusted plans before opening a state session or contacting storage.
  diffManifests({ version: 1, assets: [] }, { version: 1, assets: plan.map(action => action.asset) });
  for (const action of plan) if (!['upload', 'replace', 'skip', 'report-removed'].includes(action.type)) throw new Error('Invalid migration action');
  const root = await realpath(options.root);
  const session = await (options.stateStore ?? new LocalDeploymentStateStore()).acquire(options.adapter.target);
  let state: DeploymentState;
  try { state = validateDeploymentState(session.state, options.adapter.target); }
  catch (error) { await session.close(); throw error; }
  const records = new Map(state.assets.map(record => [record.key, record]));
  let stateError: unknown;
  let writes = Promise.resolve();
  function save(record: DeploymentRecord): Promise<void> {
    const write = writes.then(async () => {
      if (stateError) throw stateError;
      records.set(record.key, record);
      state.assets = [...records.values()].sort((a, b) => comparePaths(a.key, b.key));
      try { await session.save(state); }
      catch (error) { stateError = error; throw error; }
    });
    writes = write.catch(() => {});
    return write;
  }
  try {
    const processAction = async (action: MigrationAction): Promise<MigrationResult> => {
      const key = objectKey(options.adapter.target, action.asset.storageKey);
      let attempts = 0;
      let phase: 'local' | 'state' | 'verification' | 'remote' = 'remote';
      const retry = async <T>(operation: () => Promise<T>): Promise<T> => {
        for (let attempt = 1; ; attempt++) {
          options.signal?.throwIfAborted();
          attempts++;
          try { return await operation(); }
          catch (error) {
            if (!(error instanceof StorageError) || error.code !== 'transient' || attempt >= maxAttempts) throw error;
            await delay(Math.min(30_000, retryDelayMs * 2 ** (attempt - 1)), undefined, { signal: options.signal });
          }
        }
      };
      try {
        options.signal?.throwIfAborted();
        if (stateError) { phase = 'state'; throw stateError; }
        if (action.type === 'report-removed') return { action, key, status: 'removed', attempts };
        const remote = await retry(() => options.adapter.head(key, options.signal));
        if (matches(remote, action.asset, cacheControl)) {
          phase = 'state';
          const prior = records.get(key);
          await save({ asset: action.asset, key, cacheControl, status: 'verified',
            uploadedAt: prior?.asset.hash === action.asset.hash ? prior.uploadedAt : undefined,
            verifiedAt: new Date().toISOString(), etag: remote?.etag });
          return { action, key, status: 'skipped', attempts };
        }
        if (remote && !options.overwrite) throw new StorageError('Remote object differs or has no trusted hash; enable overwrite to replace it.', 'conflict');
        if (remote && !remote.etag) throw new StorageError('Remote object has no ETag for conditional replacement.', 'conflict');
        phase = 'remote';
        const uploaded = await retry(async () => {
          try {
            return await options.adapter.upload({
              key, size: action.asset.size, mimeType: action.asset.mimeType, sha256: action.asset.hash,
              cacheControl, condition: remote ? { ifMatch: remote.etag! } : { ifAbsent: true },
              openBody: () => openAsset(root, action.asset, options.signal), signal: options.signal,
            });
          } catch (error) {
            // A previous PUT may have succeeded even if its response was lost.
            if (error instanceof StorageError && error.code === 'conflict') {
              const observed = await retry(() => options.adapter.head(key, options.signal));
              if (matches(observed, action.asset, cacheControl)) return { etag: observed?.etag };
            }
            throw error;
          }
        });
        const uploadedRecord: DeploymentRecord = { asset: action.asset, key, cacheControl,
          status: 'uploaded', uploadedAt: new Date().toISOString(), etag: uploaded.etag };
        phase = 'state';
        await save(uploadedRecord);
        phase = 'verification';
        const verified = await retry(async () => {
          const observed = await options.adapter.head(key, options.signal);
          if (!matches(observed, action.asset, cacheControl)) throw new StorageError('Uploaded object metadata could not be verified.', 'transient');
          return observed!;
        });
        phase = 'state';
        await save({ ...uploadedRecord, status: 'verified', verifiedAt: new Date().toISOString(), etag: verified.etag });
        return { action, key, status: 'uploaded', attempts, replaced: remote !== null };
      } catch (error) {
        const aborted = options.signal?.aborted || (error instanceof StorageError && error.code === 'aborted');
        return { action, key, status: aborted ? 'cancelled' : 'failed', attempts,
          error: error instanceof Error ? error.message : 'Migration failed',
          errorCode: phase === 'state' ? 'state' : phase === 'verification' ? 'verification' :
            error instanceof StorageError ? error.code : 'local' };
      }
    };
    const results = await mapConcurrent(plan, concurrency, async action => {
      const result = await processAction(action);
      options.onResult?.(result);
      return result;
    });
    return { success: results.every(result => result.status !== 'failed' && result.status !== 'cancelled'), results, state };
  } finally { await session.close(); }
}
