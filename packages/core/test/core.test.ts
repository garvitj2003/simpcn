import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  scanAssets, analyzeAsset, hashAsset, generateManifest, diffManifests, planMigration, mapConcurrent,
  type AssetManifest, type AssetRecord,
} from '../src/index.js';

let fixture: string;
let root: string;
beforeEach(async () => {
  fixture = await mkdtemp(path.join(tmpdir(), 'assets-cdn-'));
  root = path.join(fixture, 'public');
  await mkdir(root);
});
afterEach(async () => { await rm(fixture, { recursive: true, force: true }); });
async function file(relative: string, contents: string | Buffer = '') {
  const absolute = path.join(root, relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, contents);
  return absolute;
}

describe('scanner', () => {
  it('returns sorted nested, hidden, and spaced filenames consistently', async () => {
    await file('z.txt');
    await file('icons/menu icon.svg');
    await file('.hidden');
    await mkdir(path.join(root, 'empty'));
    const first = await scanAssets({ root });
    expect(first.map(a => a.relativePath)).toEqual(['.hidden', 'icons/menu icon.svg', 'z.txt']);
    expect(await scanAssets({ root })).toEqual(first);
  });
  it('supports glob exclusions, including pruning directories', async () => {
    await file('keep.svg');
    await file('nested/skip.txt');
    await file('ignored/deep/file.svg');
    expect((await scanAssets({ root, exclude: ['**/*.txt', 'ignored'] })).map(a => a.relativePath)).toEqual(['keep.svg']);
  });
  it('skips file, directory, cyclic and dangling symlinks', async () => {
    const regular = await file('keep.txt');
    await writeFile(path.join(fixture, 'outside.txt'), 'outside');
    await symlink(regular, path.join(root, 'internal-link'));
    await symlink(path.join(fixture, 'outside.txt'), path.join(root, 'external-link'));
    await symlink(fixture, path.join(root, 'outside-dir'), 'dir');
    await symlink(root, path.join(root, 'cycle'), 'dir');
    await symlink(path.join(fixture, 'missing'), path.join(root, 'dangling'));
    expect((await scanAssets({ root })).map(a => a.relativePath)).toEqual(['keep.txt']);
  });
  it('handles empty roots and rejects missing or file roots', async () => {
    expect(await scanAssets({ root })).toEqual([]);
    await expect(scanAssets({ root: path.join(root, 'missing') })).rejects.toThrow();
    await expect(scanAssets({ root: await file('file.txt') })).rejects.toThrow('directory');
  });
});

describe('analyzer', () => {
  it('separates keys, paths and URL encoding with case-insensitive MIME lookup', async () => {
    await file('icons/Menu #1.SVG', '<svg/>');
    const [asset] = await scanAssets({ root });
    expect(await analyzeAsset(asset)).toEqual({ ...asset, extension: '.svg', size: 6,
      mimeType: 'image/svg+xml', publicPath: '/icons/Menu%20%231.SVG' });
  });
  it('uses a binary fallback and rejects traversal keys', async () => {
    const absolutePath = await file('unknown.weird', 'abc');
    expect((await analyzeAsset({ absolutePath, relativePath: 'unknown.weird' })).mimeType).toBe('application/octet-stream');
    for (const relativePath of ['../outside', '/absolute', 'a\\b', 'a//b', 'a/./b', 'C:/file']) {
      await expect(analyzeAsset({ absolutePath, relativePath })).rejects.toThrow('Invalid asset path');
    }
  });
});

describe('hasher', () => {
  it('matches the SHA-256 empty-file vector', async () => {
    expect(await hashAsset(await file('empty'))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });
  it('hashes duplicate and large content and detects same-size edits', async () => {
    const bytes = Buffer.alloc(8 * 1024 * 1024, 42);
    const a = await file('a.bin', bytes);
    const b = await file('b.bin', bytes);
    const expected = createHash('sha256').update(bytes).digest('hex');
    expect(await hashAsset(a)).toBe(expected);
    expect(await hashAsset(b)).toBe(expected);
    bytes[0] = 43;
    await writeFile(a, bytes);
    expect(await hashAsset(a)).not.toBe(expected);
  });
  it('rejects symlinks and missing files', async () => {
    const source = await file('source');
    const link = path.join(root, 'link');
    await symlink(source, link);
    await expect(hashAsset(link)).rejects.toThrow();
    await expect(hashAsset(path.join(root, 'missing'))).rejects.toThrow();
  });
  it('bounds workers while preserving input order', async () => {
    let active = 0;
    let maximum = 0;
    const result = await mapConcurrent([1, 2, 3, 4, 5], 2, async item => {
      maximum = Math.max(maximum, ++active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active--;
      return item * 2;
    });
    expect(maximum).toBe(2);
    expect(result).toEqual([2, 4, 6, 8, 10]);
    await expect(mapConcurrent([], 0, async x => x)).rejects.toThrow('Concurrency');
  });
});

describe('manifest', () => {
  it('is deterministic across runs and concurrency settings, without machine paths', async () => {
    await file('z.svg', '<svg/>');
    await file('nested/a.txt', 'hello');
    const first = await generateManifest({ root, concurrency: 1 });
    expect(await generateManifest({ root, concurrency: 4 })).toEqual(first);
    expect(first.version).toBe(1);
    expect(first.assets.map(a => a.storageKey)).toEqual(['nested/a.txt', 'z.svg']);
    expect(JSON.stringify(first)).not.toContain(root);
    expect(Object.keys(first.assets[0])).toEqual(['relativePath', 'hash', 'size', 'mimeType', 'storageKey']);
  });
  it('does not return a partial manifest on a scan failure', async () => {
    await expect(generateManifest({ root: path.join(root, 'missing') })).rejects.toThrow();
  });
});

const record = (relativePath: string, content = relativePath): AssetRecord => ({ relativePath,
  hash: createHash('sha256').update(content).digest('hex'), size: Buffer.byteLength(content),
  mimeType: 'text/plain', storageKey: relativePath });
const manifest = (...assets: AssetRecord[]): AssetManifest => ({ version: 1, assets });

describe('diff and planner', () => {
  it('classifies all four states and plans without modifying inputs or files', async () => {
    const unchanged = record('same');
    const previous = manifest(record('removed'), record('modified', 'before'), unchanged);
    const current = manifest(unchanged, record('modified', 'after'), record('added'));
    const snapshot = JSON.stringify([previous, current]);
    const diff = diffManifests(previous, current);
    expect(diff.added.map(a => a.relativePath)).toEqual(['added']);
    expect(diff.modified.map(a => a.current.relativePath)).toEqual(['modified']);
    expect(diff.unchanged).toEqual([unchanged]);
    expect(diff.removed.map(a => a.relativePath)).toEqual(['removed']);
    const local = await file('untouched', 'bytes');
    const plan = planMigration(diff);
    expect(plan.map(a => a.type)).toEqual(['upload', 'replace', 'report-removed', 'skip']);
    expect(plan[1].cacheInvalidationRequired).toBe(true);
    expect(plan.every(a => a.reason.length > 0)).toBe(true);
    expect(plan[2].reason).toContain('does not authorize remote deletion');
    expect(plan[3].reason).toContain('remote presence has not been verified');
    expect(JSON.stringify([previous, current])).toBe(snapshot);
    expect(await readFile(local, 'utf8')).toBe('bytes');
  });
  it('treats renames as additions and removals, and metadata edits as modifications', () => {
    const previous = manifest(record('old', 'same bytes'));
    const current = manifest(record('new', 'same bytes'));
    const diff = diffManifests(previous, current);
    expect(diff.added).toHaveLength(1);
    expect(diff.removed).toHaveLength(1);
    const asset = record('asset');
    expect(diffManifests(manifest(asset), manifest({ ...asset, mimeType: 'application/octet-stream' })).modified).toHaveLength(1);
  });
  it('rejects duplicate, unsupported and malformed manifests', () => {
    const asset = record('asset');
    expect(() => diffManifests(manifest(asset, asset), manifest())).toThrow('Duplicate');
    expect(() => diffManifests({ version: 2, assets: [] } as unknown as AssetManifest, manifest())).toThrow('version');
    expect(() => diffManifests(manifest({ ...asset, hash: 'bad' }), manifest())).toThrow('Invalid');
  });
  it('supports an empty baseline and an empty current inventory', () => {
    const current = manifest(record('asset'));
    expect(diffManifests(manifest(), current).added).toHaveLength(1);
    expect(diffManifests(current, manifest()).removed).toHaveLength(1);
    expect(planMigration(diffManifests(manifest(), manifest()))).toEqual([]);
  });
});
