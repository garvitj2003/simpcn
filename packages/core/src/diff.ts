import { assertAssetPath, comparePaths } from './scanner.js';
import type { AssetDiff, AssetManifest, AssetRecord } from './types.js';

function indexManifest(manifest: AssetManifest): Map<string, AssetRecord> {
  if (manifest.version !== 1) throw new Error('Unsupported manifest version');
  const index = new Map<string, AssetRecord>();
  for (const asset of manifest.assets) {
    assertAssetPath(asset.relativePath);
    if (asset.storageKey !== asset.relativePath || !/^[a-f0-9]{64}$/.test(asset.hash) ||
        !Number.isSafeInteger(asset.size) || asset.size < 0 || !asset.mimeType) {
      throw new Error(`Invalid manifest record: ${asset.relativePath}`);
    }
    if (index.has(asset.relativePath)) throw new Error(`Duplicate asset: ${asset.relativePath}`);
    index.set(asset.relativePath, asset);
  }
  return index;
}

export function diffManifests(previous: AssetManifest, current: AssetManifest): AssetDiff {
  const old = indexManifest(previous);
  const next = indexManifest(current);
  const diff: AssetDiff = { added: [], modified: [], unchanged: [], removed: [] };
  for (const key of [...next.keys()].sort(comparePaths)) {
    const asset = next.get(key)!;
    const prior = old.get(key);
    if (!prior) diff.added.push(asset);
    else if (prior.hash !== asset.hash || prior.size !== asset.size || prior.mimeType !== asset.mimeType) {
      diff.modified.push({ previous: prior, current: asset });
    } else diff.unchanged.push(asset);
  }
  for (const key of [...old.keys()].sort(comparePaths)) {
    if (!next.has(key)) diff.removed.push(old.get(key)!);
  }
  return diff;
}
