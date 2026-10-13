import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { mkdtemp, mkdir, readdir, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  prepareMigration, migrateProject, checkRemotePlan, MemoryStorageAdapter, StorageError,
  type ProjectOptions,
} from '../src/index.js';

let directory: string;
let adapter: MemoryStorageAdapter;
let options: ProjectOptions;
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'simpcn-project-'));
  const root = path.join(directory, 'public');
  await mkdir(root);
  await writeFile(path.join(root, 'asset.txt'), 'bytes');
  adapter = new MemoryStorageAdapter();
  options = { root, manifestFile: path.join(directory, 'manifest.json'), target: adapter.target };
});
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });
const migrate = (extra = {}) => migrateProject({ ...options, adapter, stateFile: path.join(directory, 'state.json'), ...extra });

describe('project orchestration', () => {
  it('updates a scoped manifest and notifies once per completed asset', async () => {
    const onResult = vi.fn();
    const first = await migrate({ onResult });
    expect(first.report.success).toBe(true);
    expect(onResult).toHaveBeenCalledTimes(1);
    expect(onResult.mock.calls[0][0].status).toBe('uploaded');
    const stored = JSON.parse(await readFile(options.manifestFile, 'utf8'));
    expect(stored.target).toEqual(adapter.target);
    expect(stored.root).toBe(options.root);
    expect((await prepareMigration(options)).diff.unchanged).toHaveLength(1);
    await expect(prepareMigration({ ...options, target: { ...adapter.target, prefix: 'other' } })).rejects.toThrow('different root or storage target');
  });
  it('keeps the previous baseline on a failed run and rejects concurrent manifest owners', async () => {
    await migrate();
    const before = await readFile(options.manifestFile, 'utf8');
    await writeFile(path.join(options.root, 'new.txt'), 'new');
    const upload = vi.spyOn(adapter, 'upload').mockRejectedValue(new StorageError('denied', 'auth'));
    expect((await migrate()).report.success).toBe(false);
    expect(await readFile(options.manifestFile, 'utf8')).toBe(before);
    upload.mockRestore();
    await writeFile(`${options.manifestFile}.lock`, '{}');
    await expect(migrate()).rejects.toThrow('locked');
  });
  it('checks remote metadata with bounded retries and does not write files or upload', async () => {
    const prepared = await prepareMigration(options);
    const before = await readdir(directory);
    const original = adapter.head.bind(adapter);
    const head = vi.spyOn(adapter, 'head').mockRejectedValueOnce(new StorageError('temporary', 'transient'))
      .mockImplementation(original);
    const upload = vi.spyOn(adapter, 'upload');
    const checked = await checkRemotePlan(prepared.plan, { adapter, retryDelayMs: 0 });
    expect(checked[0].decision).toBe('upload');
    expect(head).toHaveBeenCalledTimes(2);
    expect(upload).not.toHaveBeenCalled();
    expect(await readdir(directory)).toEqual(before);
    head.mockRejectedValue(new StorageError('denied', 'auth'));
    head.mockClear();
    expect((await checkRemotePlan(prepared.plan, { adapter }))[0].decision).toBe('failed');
    expect(head).toHaveBeenCalledTimes(1);
  });
  it('reports a missing unchanged remote object as an upload', async () => {
    await migrate();
    adapter.objects.clear();
    const prepared = await prepareMigration(options);
    expect(prepared.plan[0].type).toBe('skip');
    expect((await checkRemotePlan(prepared.plan, { adapter }))[0].decision).toBe('upload');
  });
  it('cancels preparation before scanning or creating files', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(prepareMigration({ ...options, signal: controller.signal })).rejects.toThrow();
    expect(await readdir(directory)).toEqual(['public']);
  });
});
