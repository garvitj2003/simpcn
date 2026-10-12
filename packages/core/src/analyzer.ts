import { lstat } from 'node:fs/promises';
import path from 'node:path';
import { assertAssetPath } from './scanner.js';
import type { AnalyzedAsset, ScannedAsset } from './types.js';

const mimeTypes: Record<string, string> = {
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.avif': 'image/avif', '.ico': 'image/vnd.microsoft.icon', '.bmp': 'image/bmp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.html': 'text/html', '.txt': 'text/plain',
  '.pdf': 'application/pdf', '.xml': 'application/xml', '.wasm': 'application/wasm',
};

export async function analyzeAsset(asset: ScannedAsset): Promise<AnalyzedAsset> {
  assertAssetPath(asset.relativePath);
  const stat = await lstat(asset.absolutePath);
  if (!stat.isFile()) throw new Error(`Not a regular asset file: ${asset.relativePath}`);
  const extension = path.posix.extname(asset.relativePath).toLowerCase();
  return {
    ...asset, extension, size: stat.size,
    publicPath: '/' + asset.relativePath.split('/').map(encodeURIComponent).join('/'),
    mimeType: mimeTypes[extension] ?? 'application/octet-stream',
  };
}
