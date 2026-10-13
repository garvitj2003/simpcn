import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { generateManifest } from './manifest.js';
import { diffManifests } from './diff.js';
import { planMigration } from './planner.js';
import { mapConcurrent } from './hasher.js';
import { executeMigration, type ExecuteMigrationOptions } from './storage/executor.js';
import { LocalDeploymentStateStore, objectKey, sameTarget, validateTarget } from './storage/state.js';
import { StorageError, type StorageAdapter, type StorageTarget } from './storage/types.js';
import type { AssetManifest, ScanOptions, MigrationAction } from './types.js';

export interface ProjectOptions extends ScanOptions {
  root: string;
  manifestFile: string;
  target: StorageTarget;
  hashConcurrency?: number;
  signal?: AbortSignal;
}
export async function prepareMigration(options: ProjectOptions) {
  validateTarget(options.target);
  options.signal?.throwIfAborted();
  let previous: AssetManifest = { version: 1, assets: [] };
  try {
    const stored = JSON.parse(await readFile(options.manifestFile, 'utf8'));
    if (stored.version !== 1 || !stored.target || !sameTarget(stored.target, options.target) || stored.root !== path.resolve(options.root)) {
      throw new Error('Local manifest belongs to a different root or storage target; use a separate manifest file');
    }
    previous = stored.manifest;
  } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const manifest = await generateManifest({ root: options.root, exclude: options.exclude, concurrency: options.hashConcurrency, signal: options.signal });
  options.signal?.throwIfAborted();
  const diff = diffManifests(previous, manifest);
  return { manifest, diff, plan: planMigration(diff) };
}

export interface RemotePlanAction {
  action: MigrationAction;
  key: string;
  decision: 'upload' | 'replace' | 'skip' | 'report-removed' | 'conflict' | 'failed' | 'cancelled';
  reason: string;
}
/** HEAD-only reconciliation. No uploads, local writes or state sessions. */
export async function checkRemotePlan(plan: readonly MigrationAction[], options: {
  adapter: StorageAdapter;
  cacheControl?: string;
  overwrite?: boolean;
  concurrency?: number;
  maxAttempts?: number;
  retryDelayMs?: number;
  signal?: AbortSignal;
}): Promise<RemotePlanAction[]> {
  const cacheControl = options.cacheControl ?? 'public, max-age=0, must-revalidate';
  const maxAttempts = options.maxAttempts ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 200;
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || !Number.isFinite(retryDelayMs) || retryDelayMs < 0) throw new Error('Invalid retry settings');
  diffManifests({ version: 1, assets: [] }, { version: 1, assets: plan.map(action => action.asset) });
  return mapConcurrent(plan, options.concurrency ?? 4, async action => {
    const key = objectKey(options.adapter.target, action.asset.storageKey);
    const result = (decision: RemotePlanAction['decision'], reason: string): RemotePlanAction => ({ action, key, decision, reason });
    try {
      options.signal?.throwIfAborted();
      if (action.type === 'report-removed') return result('report-removed', 'Absent locally; no remote deletion proposed.');
      let remote;
      for (let attempt = 1; ; attempt++) {
        try { remote = await options.adapter.head(key, options.signal); break; }
        catch (error) {
          if (!(error instanceof StorageError) || error.code !== 'transient' || attempt >= maxAttempts) throw error;
          await delay(Math.min(30_000, retryDelayMs * 2 ** (attempt - 1)), undefined, { signal: options.signal });
        }
      }
      if (!remote) return result('upload', 'Object is missing remotely.');
      if (remote.sha256 === action.asset.hash && remote.size === action.asset.size &&
          remote.mimeType === action.asset.mimeType && remote.cacheControl === cacheControl) {
        return result('skip', 'Remote metadata matches.');
      }
      if (!options.overwrite || !remote.etag) return result('conflict', 'Remote object differs or is unverified; replacement requires --overwrite and a remote ETag.');
      return result('replace', 'Remote object differs; conditional replacement requires cache review.');
    } catch (error) {
      return result(options.signal?.aborted ? 'cancelled' : 'failed', error instanceof Error ? error.message : 'Remote check failed');
    }
  });
}

export async function migrateProject(options: Omit<ProjectOptions, 'target'> & Omit<ExecuteMigrationOptions, 'stateStore'> & { stateFile: string }) {
  const manifestFile = path.resolve(options.manifestFile);
  await mkdir(path.dirname(manifestFile), { recursive: true });
  const lockPath = `${manifestFile}.lock`;
  let lock;
  try { lock = await open(lockPath, 'wx', 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('Local manifest is locked; check for a running migration before removing a stale lock');
    throw error;
  }
  try {
    await lock.writeFile(JSON.stringify({ pid: process.pid }));
    const prepared = await prepareMigration({ ...options, target: options.adapter.target });
    const report = await executeMigration(prepared.plan, { ...options, stateStore: new LocalDeploymentStateStore(options.stateFile) });
    if (report.success) {
      const temporary = `${manifestFile}.${randomUUID()}.tmp`;
      try {
        const file = await open(temporary, 'wx', 0o600);
        try {
          await file.writeFile(JSON.stringify({ version: 1, root: path.resolve(options.root), target: options.adapter.target,
            manifest: prepared.manifest }, null, 2) + '\n');
          await file.sync();
        } finally { await file.close(); }
        await rename(temporary, manifestFile);
      } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    }
    return { ...prepared, report };
  } finally { await lock.close(); await unlink(lockPath); }
}
