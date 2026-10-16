import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { MemoryStorageAdapter, StorageError } from '@simpcn/core';
import { runCli } from '../src/run.js';
import { version } from '../src/version.js';
import { loadConfig } from '../src/config.js';

let cwd: string;
let adapter: MemoryStorageAdapter;
let stdout: string;
let stderr: string;
const bin = fileURLToPath(new URL('../dist/bin.js', import.meta.url));
beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), 'simpcn-cli-'));
  await mkdir(path.join(cwd, 'public'));
  adapter = new MemoryStorageAdapter({ service: 'aws-s3:us-east-1', bucket: 'test', prefix: '' });
  stdout = ''; stderr = '';
});
afterEach(async () => { await rm(cwd, { recursive: true, force: true }); });
async function config(extra: Record<string, unknown> = {}) {
  await writeFile(path.join(cwd, 'simpcn.config.ts'), 'export default ' + JSON.stringify({ version: 1, storage: { bucket: 'test' }, ...extra }));
}
async function cli(args: string[], signal?: AbortSignal) {
  stdout = ''; stderr = '';
  return runCli(args, { cwd, stdout: text => { stdout += text; }, stderr: text => { stderr += text; },
    signal, createAdapter: () => adapter });
}

describe('CLI commands', () => {
  it('provides executable help/version and rejects unknown arguments with exit 2', async () => {
    const help = spawnSync(process.execPath, [bin, '--help'], { cwd, encoding: 'utf8' });
    expect(help.status).toBe(0);
    expect(help.stdout).toContain('simpcn <command>');
    expect(help.stderr).toBe('');
    expect(await cli(['--version'])).toBe(0);
    expect(stdout.trim()).toBe(version);
    for (const args of [['unknown'], ['plan', '--wat'], ['plan', '--force'], ['migrate', '--check-remote'],
      ['plan', '--overwrite'], ['plan', '--config', ''], ['plan', '--bucket', 'a', '--bucket', 'b']]) {
      expect(await cli([...args, '--json'])).toBe(2);
      expect(JSON.parse(stdout).success).toBe(false);
    }
  });
  it('initializes config without secrets and refuses existing config unless forced', async () => {
    expect(await cli(['init', '--bucket', 'test', '--json'])).toBe(0);
    const text = await readFile(path.join(cwd, 'simpcn.config.ts'), 'utf8');
    expect((await loadConfig({}, cwd)).root).toBe(path.join(cwd, 'public'));
    expect(text).not.toContain('credentials');
    expect(await cli(['init'])).toBe(2);
    expect(await readFile(path.join(cwd, 'simpcn.config.ts'), 'utf8')).toBe(text);
    expect(await cli(['init', '--bucket', 'changed', '--force'])).toBe(0);
    expect((await loadConfig({}, cwd)).storage.bucket).toBe('changed');
  });
  it('plans without opening an adapter or creating state', async () => {
    await config();
    await writeFile(path.join(cwd, 'public', 'asset.txt'), 'bytes');
    const before = await readdir(cwd);
    const factory = vi.fn(() => { throw new Error('Local plan must not open storage'); });
    const code = await runCli(['plan', '--json'], { cwd, createAdapter: factory,
      stdout: text => { stdout += text; }, stderr: text => { stderr += text; } });
    expect(code).toBe(0);
    expect(factory).not.toHaveBeenCalled();
    const output = JSON.parse(stdout);
    expect(output.summary).toMatchObject({ added: 1, proposedUploadBytes: 5 });
    expect(output.dryRun).toBe(true);
    expect(stderr).toBe('');
    expect(await readdir(cwd)).toEqual(before);
  });
  it('remote-checks without writes and reports conflicts', async () => {
    await config();
    await writeFile(path.join(cwd, 'public', 'asset'), 'bytes');
    const upload = vi.spyOn(adapter, 'upload');
    expect(await cli(['plan', '--check-remote', '--json'])).toBe(0);
    expect(JSON.parse(stdout).remote[0].decision).toBe('upload');
    adapter.objects.set('asset', { key: 'asset', size: 1, body: Buffer.from('x'), etag: '"old"' });
    expect(await cli(['plan', '--check-remote', '--json'])).toBe(1);
    expect(JSON.parse(stdout).remote[0].decision).toBe('conflict');
    expect(await cli(['plan', '--check-remote', '--overwrite', '--json'])).toBe(0);
    expect(JSON.parse(stdout).remote[0].decision).toBe('replace');
    expect(upload).not.toHaveBeenCalled();
    expect((await readdir(cwd)).includes('.simpcn')).toBe(false);
  });
  it('migrates, persists the baseline, skips repeat runs, and reports removals', async () => {
    await config();
    const asset = path.join(cwd, 'public', 'asset');
    await writeFile(asset, 'bytes');
    expect(await cli(['migrate', '--json'])).toBe(0);
    expect(JSON.parse(stdout).summary.uploaded).toBe(1);
    expect(stderr).toBe('');
    expect(await cli(['plan', '--json'])).toBe(0);
    expect(JSON.parse(stdout).summary.unchanged).toBe(1);
    expect(await cli(['migrate'])).toBe(0);
    expect(stdout).toContain('1 skipped');
    expect(stderr).not.toContain('skipped');
    expect(stdout).toContain('Migration complete');
    await rm(asset);
    expect(await cli(['migrate', '--json'])).toBe(0);
    expect(JSON.parse(stdout).summary.removed).toBe(1);
    expect(adapter.objects.has('asset')).toBe(true);
  });
  it('shows compact local and remote plans while retaining conflict details', async () => {
    await config();
    await writeFile(path.join(cwd, 'public', 'asset'), 'bytes');
    expect(await cli(['plan'])).toBe(0);
    expect(stdout).toContain('1 added');
    expect(stdout).toContain('5 B');
    expect(stdout).toContain('Remote unchecked');
    expect(stdout).toContain('Dry run');
    adapter.objects.set('asset', { key: 'asset', size: 1, body: Buffer.from('x'), etag: '"old"' });
    expect(await cli(['plan', '--check-remote'])).toBe(1);
    expect(stdout).toContain('1 conflict');
    expect(stdout).toContain('--overwrite');
    expect(stdout.match(/asset/g)).toHaveLength(1);
    expect(await cli(['migrate'])).toBe(1);
    expect(stderr).toContain('failed');
    expect(stderr).toContain('enable overwrite');
    expect(stdout).toContain('Migration incomplete');
  });
  it('keeps terminal colors optional and JSON free from layout or ANSI output', async () => {
    await config();
    await writeFile(path.join(cwd, 'public', 'asset'), 'bytes');
    const noColor = spawnSync(process.execPath, [bin, 'plan'], {
      cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '1' },
    });
    expect(noColor.status).toBe(0);
    expect(noColor.stdout + noColor.stderr).not.toContain('\u001b[');
    const color = spawnSync(process.execPath, [bin, 'plan'], {
      cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: undefined, FORCE_COLOR: '1' },
    });
    expect(color.status).toBe(0);
    expect(color.stdout + color.stderr).toContain('\u001b[');
    const json = spawnSync(process.execPath, [bin, 'plan', '--json'], {
      cwd, encoding: 'utf8', env: { ...process.env, NO_COLOR: undefined, FORCE_COLOR: '1' },
    });
    expect(json.status).toBe(0);
    expect(json.stderr).toBe('');
    expect(json.stdout).not.toContain('\u001b[');
    expect(JSON.parse(json.stdout).summary.added).toBe(1);
  });
  it('reports partial failure and recovers without reuploading successful objects', async () => {
    await config();
    await writeFile(path.join(cwd, 'public', 'a'), 'a');
    await writeFile(path.join(cwd, 'public', 'b'), 'b');
    const original = adapter.upload.bind(adapter);
    const uploads = vi.spyOn(adapter, 'upload').mockImplementation(async input => {
      if (input.key === 'b') throw new StorageError('denied', 'auth');
      return original(input);
    });
    expect(await cli(['migrate', '--json'])).toBe(1);
    expect(JSON.parse(stdout).summary).toMatchObject({ uploaded: 1, failed: 1 });
    expect((await readdir(path.join(cwd, '.simpcn'))).includes('manifest.json')).toBe(false);
    uploads.mockRestore();
    expect(await cli(['migrate', '--json'])).toBe(0);
    expect(JSON.parse(stdout).summary).toMatchObject({ uploaded: 1, skipped: 1 });
  });
  it('cancels with exit 130 and releases locks for a subsequent migration', async () => {
    await config();
    await writeFile(path.join(cwd, 'public', 'asset'), 'bytes');
    const controller = new AbortController();
    const original = adapter.head.bind(adapter);
    const head = vi.spyOn(adapter, 'head').mockImplementation(async (key, signal) => {
      controller.abort(); signal?.throwIfAborted(); return original(key);
    });
    expect(await cli(['migrate', '--json'], controller.signal)).toBe(130);
    expect(JSON.parse(stdout).summary.cancelled).toBe(1);
    head.mockRestore();
    expect(await cli(['migrate', '--json'])).toBe(0);
  });
});

describe('configuration', () => {
  it('finds config from child directories and resolves config paths independently of cwd', async () => {
    await config({ exclude: ['**/*.txt'], concurrency: 2 });
    const child = path.join(cwd, 'nested');
    await mkdir(child);
    const resolved = await loadConfig({ root: '.', concurrency: '3', exclude: ['**/*.svg'] }, child);
    expect(resolved.root).toBe(child);
    expect(resolved.stateFile).toBe(path.join(cwd, '.simpcn', 'deployment-state.json'));
    expect(resolved.concurrency).toBe(3);
    expect(resolved.exclude).toEqual(['**/*.svg']);
    expect((await loadConfig({}, child)).root).toBe(path.join(cwd, 'public'));
  });
  it('rejects malformed config, unknown fields, bad numbers and unsafe state locations', async () => {
    for (const extra of [{ concurrency: 0 }, { maxAttempts: 1.5 }, { exclude: 'not-an-array' },
      { storage: { bucket: 'test', credentials: {} } }, { root: 'public', stateFile: 'public/state.json' },
      { version: 2 }, { unknown: true }]) {
      await config(extra);
      expect(await cli(['plan', '--json'])).toBe(2);
    }
    await writeFile(path.join(cwd, 'simpcn.config.ts'), '{bad');
    expect(await cli(['plan', '--json'])).toBe(2);
    expect(JSON.parse(stdout).error).toMatch(/Invalid|Unexpected|Parse/);
  });
  it('fails explicitly for a missing configured file and keeps manifests scoped to their target', async () => {
    expect(await cli(['plan', '--config', 'missing.json', '--json'])).toBe(2);
    await config();
    await writeFile(path.join(cwd, 'public', 'asset'), 'bytes');
    expect(await cli(['migrate', '--json'])).toBe(0);
    expect(await cli(['plan', '--bucket', 'other', '--json'])).toBe(1);
    expect(JSON.parse(stdout).error).toContain('different root or storage target');
  });
});
