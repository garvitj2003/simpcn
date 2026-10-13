import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile, symlink } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {
  generateManifest, diffManifests, planMigration, executeMigration,
  LocalDeploymentStateStore, MemoryStorageAdapter, StorageError,
  type AssetManifest, type DeploymentState, type UploadInput,
} from '../src/index.js';

let directory: string;
let root: string;
let stateFile: string;
let adapter: MemoryStorageAdapter;
const empty: AssetManifest = { version: 1, assets: [] };
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'simpcn-storage-'));
  root = path.join(directory, 'public');
  stateFile = path.join(directory, 'state.json');
  await mkdir(root);
  adapter = new MemoryStorageAdapter({ service: 'memory', bucket: 'test', prefix: 'app' });
});
afterEach(async () => { await rm(directory, { force: true, recursive: true }); });
async function write(name: string, content = name) { await writeFile(path.join(root, name), content); }
async function plan(previous = empty) { return planMigration(diffManifests(previous, await generateManifest({ root }))); }
const run = async (actions: Awaited<ReturnType<typeof plan>>, extras = {}) => executeMigration(actions, {
  root, adapter, stateStore: new LocalDeploymentStateStore(stateFile), retryDelayMs: 0, ...extras,
});
const readState = async (): Promise<DeploymentState> => JSON.parse(await readFile(stateFile, 'utf8'));

describe('executor reconciliation', () => {
  it('uploads, verifies and skips on repeat while keeping state separate from manifests', async () => {
    await write('a.svg', '<svg/>');
    await write('empty.txt', '');
    const actions = await plan();
    const first = await run(actions);
    expect(first.success).toBe(true);
    expect(first.results.map(r => r.status)).toEqual(['uploaded', 'uploaded']);
    expect([...adapter.objects.keys()].sort()).toEqual(['app/a.svg', 'app/empty.txt']);
    expect(first.state.assets.every(a => a.status === 'verified' && a.uploadedAt && a.verifiedAt)).toBe(true);
    expect((await readState()).assets).toHaveLength(2);
    const upload = vi.spyOn(adapter, 'upload');
    const second = await run(actions);
    expect(second.results.map(r => r.status)).toEqual(['skipped', 'skipped']);
    expect(upload).not.toHaveBeenCalled();
  });
  it('restores missing remote objects even when the local diff says skip', async () => {
    await write('asset');
    const current = await generateManifest({ root });
    await run(await plan());
    adapter.objects.delete('app/asset');
    const report = await run(planMigration(diffManifests(current, current)));
    expect(report.results[0].action.type).toBe('skip');
    expect(report.results[0].status).toBe('uploaded');
  });
  it('blocks unverified objects and replaces only with explicit overwrite', async () => {
    await write('asset');
    const actions = await plan();
    adapter.objects.set('app/asset', { key: 'app/asset', size: 5, body: Buffer.from('other'), etag: '"old"' });
    const conflict = await run(actions);
    expect(conflict.success).toBe(false);
    expect(conflict.results[0].errorCode).toBe('conflict');
    expect(adapter.objects.get('app/asset')?.body.toString()).toBe('other');
    expect((await run(actions, { overwrite: true })).results[0].status).toBe('uploaded');
  });
  it('reports removals without modifying remote storage or erasing history', async () => {
    await write('asset');
    const previous = await generateManifest({ root });
    await run(await plan());
    await rm(path.join(root, 'asset'));
    const report = await run(await plan(previous));
    expect(report.results[0].status).toBe('removed');
    expect(adapter.objects.has('app/asset')).toBe(true);
    expect(report.state.assets).toHaveLength(1);
  });
  it('rejects stale local content before uploading and lets other uploads finish', async () => {
    await write('a', 'before');
    await write('b');
    const actions = await plan();
    await write('a', 'after');
    const report = await run(actions);
    expect(report.results.map(r => r.status)).toEqual(['failed', 'uploaded']);
    expect(adapter.objects.has('app/a')).toBe(false);
    expect((await readState()).assets.map(a => a.asset.relativePath)).toEqual(['b']);
  });
  it('rejects ancestor symlinks introduced after manifest generation', async () => {
    await mkdir(path.join(root, 'nested'));
    await writeFile(path.join(root, 'nested', 'asset'), 'bytes');
    const actions = await plan();
    const outside = path.join(directory, 'outside');
    await mkdir(outside);
    await writeFile(path.join(outside, 'asset'), 'bytes');
    await rm(path.join(root, 'nested'), { recursive: true });
    await symlink(outside, path.join(root, 'nested'), 'dir');
    expect((await run(actions)).results[0].status).toBe('failed');
    expect(adapter.objects.size).toBe(0);
  });
});

describe('retries, verification and cancellation', () => {
  it('reopens streams on transient upload failures', async () => {
    await write('asset', 'bytes');
    const original = adapter.upload.bind(adapter);
    let calls = 0;
    vi.spyOn(adapter, 'upload').mockImplementation(async input => {
      if (++calls === 1) {
        const body = await input.openBody();
        for await (const _chunk of body) { /* consume the failed attempt */ }
        throw new StorageError('network interruption', 'transient');
      }
      return original(input);
    });
    expect((await run(await plan())).success).toBe(true);
    expect(calls).toBe(2);
    expect(adapter.objects.get('app/asset')?.body.toString()).toBe('bytes');
  });
  it('recovers when a PUT succeeded but its response was lost', async () => {
    await write('asset');
    const original = adapter.upload.bind(adapter);
    let first = true;
    vi.spyOn(adapter, 'upload').mockImplementation(async input => {
      const result = await original(input);
      if (first) { first = false; throw new StorageError('lost response', 'transient'); }
      return result;
    });
    const result = await run(await plan());
    expect(result.success).toBe(true);
    expect(result.state.assets[0].status).toBe('verified');
  });
  it('preserves uploaded but unverified state, then resumes using HEAD', async () => {
    await write('asset');
    const actions = await plan();
    const original = adapter.head.bind(adapter);
    const head = vi.spyOn(adapter, 'head').mockImplementation(async key => {
      if (adapter.objects.has(key)) throw new StorageError('verification unavailable', 'transient');
      return original(key);
    });
    const first = await run(actions, { maxAttempts: 2 });
    expect(first.success).toBe(false);
    expect(first.results[0].errorCode).toBe('verification');
    expect((await readState()).assets[0].status).toBe('uploaded');
    head.mockRestore();
    const upload = vi.spyOn(adapter, 'upload');
    const next = await run(actions);
    expect(next.results[0].status).toBe('skipped');
    expect(upload).not.toHaveBeenCalled();
    expect((await readState()).assets[0].status).toBe('verified');
  });
  it('never treats authentication failures as missing objects or retries them', async () => {
    await write('asset');
    const head = vi.spyOn(adapter, 'head').mockRejectedValue(new StorageError('denied', 'auth'));
    const upload = vi.spyOn(adapter, 'upload');
    const report = await run(await plan());
    expect(report.results[0].errorCode).toBe('auth');
    expect(head).toHaveBeenCalledTimes(1);
    expect(upload).not.toHaveBeenCalled();
  });
  it('preserves conditional-write conflicts when another writer changes an object', async () => {
    await write('asset', 'original');
    await run(await plan());
    await write('asset', 'changed');
    const original = adapter.upload.bind(adapter);
    vi.spyOn(adapter, 'upload').mockImplementation(async input => {
      const object = adapter.objects.get(input.key)!;
      object.etag = '"concurrent-writer"';
      return original(input);
    });
    expect((await run(await plan(), { overwrite: true })).results[0].errorCode).toBe('conflict');
    expect(adapter.objects.get('app/asset')?.body.toString()).toBe('original');
  });
  it('limits active uploads and drains them before returning', async () => {
    for (let i = 0; i < 5; i++) await write(`${i}`);
    const original = adapter.upload.bind(adapter);
    let active = 0;
    let maximum = 0;
    vi.spyOn(adapter, 'upload').mockImplementation(async (input: UploadInput) => {
      maximum = Math.max(maximum, ++active);
      try { await new Promise(resolve => setTimeout(resolve, 10)); return await original(input); }
      finally { active--; }
    });
    expect((await run(await plan(), { concurrency: 2 })).success).toBe(true);
    expect(maximum).toBe(2);
    expect(active).toBe(0);
    expect((await readState()).assets).toHaveLength(5);
  });
  it('cancels queued work without remote mutations', async () => {
    await write('asset');
    const controller = new AbortController();
    controller.abort();
    const report = await run(await plan(), { signal: controller.signal });
    expect(report.results[0].status).toBe('cancelled');
    expect(adapter.objects.size).toBe(0);
    // Lock is released even on cancellation.
    const session = await new LocalDeploymentStateStore(stateFile).acquire(adapter.target);
    await session.close();
  });
});

describe('deployment state', () => {
  it('locks concurrent sessions, rejects target mismatches and releases failed-read locks', async () => {
    const store = new LocalDeploymentStateStore(stateFile);
    const session = await store.acquire(adapter.target);
    await expect(store.acquire(adapter.target)).rejects.toThrow('locked');
    await session.close();
    await write('asset');
    await run(await plan());
    await expect(store.acquire({ ...adapter.target, bucket: 'other' })).rejects.toThrow('different storage target');
    const retry = await store.acquire(adapter.target);
    await retry.close();
    await writeFile(stateFile, '{invalid');
    await expect(store.acquire(adapter.target)).rejects.toThrow();
    await expect(readFile(`${stateFile}.lock`)).rejects.toThrow();
  });
  it('reports a failed state write and continues tracking remote success as unverified', async () => {
    await write('asset');
    const report = await run(await plan(), { stateStore: { acquire: async () => ({
      state: { version: 1, target: adapter.target, assets: [] },
      save: async () => { throw new Error('disk full'); }, close: async () => {},
    }) } });
    expect(report.results[0].errorCode).toBe('state');
    expect(report.success).toBe(false);
    expect(adapter.objects.has('app/asset')).toBe(true);
  });
});
