import { lstat } from 'node:fs/promises';
import { analyzeAsset } from './analyzer.js';
import { hashAsset, mapConcurrent } from './hasher.js';
import { scanAssets } from './scanner.js';
import type { AssetManifest, ScanOptions } from './types.js';

export async function generateManifest(options: ScanOptions & { concurrency?: number } = {}): Promise<AssetManifest> {
  const assets = await scanAssets(options);
  const records = await mapConcurrent(assets, options.concurrency ?? 8, async asset => {
    const before = await lstat(asset.absolutePath, { bigint: true });
    const metadata = await analyzeAsset(asset);
    const hash = await hashAsset(asset.absolutePath);
    const after = await lstat(asset.absolutePath, { bigint: true });
    if (before.ino !== after.ino || before.dev !== after.dev || before.size !== after.size ||
        before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) {
      throw new Error(`Asset changed during manifest generation: ${asset.relativePath}`);
    }
    return { relativePath: asset.relativePath, hash, size: metadata.size,
      mimeType: metadata.mimeType, storageKey: asset.relativePath };
  });
  return { version: 1, assets: records };
}
