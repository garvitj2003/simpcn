import { lstat, readdir, realpath } from 'node:fs/promises';
import path from 'node:path';
import type { ScanOptions, ScannedAsset } from './types.js';

export const comparePaths = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

/** Paths are canonical asset keys, not arbitrary filesystem paths. */
export function assertAssetPath(value: string): void {
  if (!value || value.includes('\\') || value.includes('\0') ||
      value.split('/').some(part => !part || part === '.' || part === '..') ||
      /^[A-Za-z]:/.test(value)) {
    throw new Error(`Invalid asset path: ${value}`);
  }
}

export async function scanAssets(options: ScanOptions = {}): Promise<ScannedAsset[]> {
  const root = await realpath(options.root ?? 'public');
  if (!(await lstat(root)).isDirectory()) throw new Error('Asset root must be a directory');
  const assets: ScannedAsset[] = [];
  async function walk(directory: string, prefix: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      assertAssetPath(relativePath);
      if (options.exclude?.some(pattern => path.posix.matchesGlob(relativePath, pattern))) continue;
      if (entry.isSymbolicLink()) continue;
      const absolutePath = path.join(directory, entry.name);
      // Recheck entries rather than trusting a directory listing that may be stale.
      const stat = await lstat(absolutePath);
      if (stat.isSymbolicLink()) continue;
      const resolved = await realpath(absolutePath);
      const relative = path.relative(root, resolved);
      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error(`Asset escaped root: ${relativePath}`);
      }
      if (stat.isDirectory()) await walk(absolutePath, relativePath);
      else if (stat.isFile()) assets.push({ absolutePath, relativePath });
    }
  }
  await walk(root, '');
  return assets.sort((a, b) => comparePaths(a.relativePath, b.relativePath));
}
