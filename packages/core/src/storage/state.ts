import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { diffManifests } from '../diff.js';
import { assertAssetPath, comparePaths } from '../scanner.js';
import type { DeploymentSession, DeploymentState, DeploymentStateStore, StorageTarget } from './types.js';

export function validateTarget(target: StorageTarget): void {
  if (!target.service || !target.bucket) throw new Error('Storage service and bucket are required');
  if (target.prefix) assertAssetPath(target.prefix);
}
export function sameTarget(a: StorageTarget, b: StorageTarget): boolean {
  return a.service === b.service && a.bucket === b.bucket && a.prefix === b.prefix;
}
export function objectKey(target: StorageTarget, relativeKey: string): string {
  validateTarget(target);
  assertAssetPath(relativeKey);
  return target.prefix ? `${target.prefix}/${relativeKey}` : relativeKey;
}

export function validateDeploymentState(value: unknown, target: StorageTarget): DeploymentState {
  const state = value as DeploymentState;
  if (!state || state.version !== 1 || !state.target || !sameTarget(state.target, target) || !Array.isArray(state.assets)) {
    throw new Error('Deployment state is invalid or belongs to a different storage target');
  }
  const keys = new Set<string>();
  for (const record of state.assets) {
    if (!record || !record.asset || record.key !== objectKey(target, record.asset.storageKey) || keys.has(record.key) ||
        typeof record.cacheControl !== 'string' || !['uploaded', 'verified'].includes(record.status) ||
        (record.status === 'uploaded' && !record.uploadedAt) ||
        (record.status === 'verified' && !record.verifiedAt)) {
      throw new Error('Invalid deployment record');
    }
    keys.add(record.key);
  }
  diffManifests({ version: 1, assets: [] }, { version: 1, assets: state.assets.map(record => record.asset) });
  return state;
}

/** Atomic JSON writes and an exclusive lock for one local migration at a time. */
export class LocalDeploymentStateStore implements DeploymentStateStore {
  constructor(readonly filename = 'simpcn/deployment-state.json') {}

  async acquire(target: StorageTarget): Promise<DeploymentSession> {
    validateTarget(target);
    const filename = path.resolve(this.filename);
    await mkdir(path.dirname(filename), { recursive: true });
    const lockPath = `${filename}.lock`;
    let lock;
    try { lock = await open(lockPath, 'wx', 0o600); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        throw new Error(`Deployment state is locked: ${lockPath}. If a process crashed, remove the lock only after confirming no migration is running.`);
      }
      throw error;
    }
    try {
      await lock.writeFile(JSON.stringify({ pid: process.pid }));
      let state: DeploymentState = { version: 1, target: { ...target }, assets: [] };
      try { state = validateDeploymentState(JSON.parse(await readFile(filename, 'utf8')), target); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
      let closed = false;
      let writes: Promise<void> = Promise.resolve();
      return {
        state,
        save(next) {
          if (closed) return Promise.reject(new Error('Deployment session is closed'));
          validateDeploymentState(next, target);
          const snapshot = JSON.stringify({ ...next,
            assets: [...next.assets].sort((a, b) => comparePaths(a.key, b.key)) }, null, 2) + '\n';
          const write = writes.then(async () => {
            const temporary = `${filename}.${randomUUID()}.tmp`;
            try {
              const file = await open(temporary, 'wx', 0o600);
              try { await file.writeFile(snapshot); await file.sync(); }
              finally { await file.close(); }
              await rename(temporary, filename);
            } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
          });
          writes = write.catch(() => {});
          return write;
        },
        async close() {
          if (closed) return;
          closed = true;
          await writes;
          await lock.close();
          await unlink(lockPath);
        },
      };
    } catch (error) {
      await lock.close();
      await unlink(lockPath);
      throw error;
    }
  }
}
