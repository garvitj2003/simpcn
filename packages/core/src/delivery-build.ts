import { readFile } from 'node:fs/promises';
import { generateManifest } from './manifest.js';
import { createAssetUrlResolver } from './delivery.js';
import { validateDeploymentState } from './storage/state.js';
import type { StorageTarget, DeploymentState } from './storage/types.js';

/** Reads fresh local bytes and deployment history, without network calls or writes. */
export async function loadAssetUrlResolver(options: {
  root: string; exclude?: readonly string[]; stateFile: string;
  target: StorageTarget; publicBaseUrl: string; basePath?: string;
  cacheControl?: string; hashConcurrency?: number;
}) {
  const manifest = await generateManifest({ root: options.root, exclude: options.exclude, concurrency: options.hashConcurrency });
  let state: DeploymentState | undefined;
  try { state = validateDeploymentState(JSON.parse(await readFile(options.stateFile, 'utf8')), options.target); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  return createAssetUrlResolver({ ...options, manifest, state });
}
