import type { AssetManifest } from './types.js';
import type { DeploymentState, StorageTarget } from './storage/types.js';

/** This module is browser-safe: it imports no filesystem code or provider SDK. */
export function normalizePublicBaseUrl(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || /[\s\u0000-\u001f]/.test(value)) {
    throw new Error('publicBaseUrl must be an HTTP(S) URL without credentials, query, fragment or whitespace');
  }
  return url.href.replace(/\/+$/, '') + '/';
}

function assetReference(value: string, basePath: string): { key: string; suffix: string } | undefined {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return undefined;
  const split = value.search(/[?#]/);
  const pathname = split < 0 ? value : value.slice(0, split);
  const suffix = split < 0 ? '' : value.slice(split);
  const prefix = basePath.endsWith('/') ? basePath : basePath + '/';
  const local = prefix !== '/' && pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname.slice(1);
  let segments: string[];
  try { segments = local.split('/').map(decodeURIComponent); } catch { return undefined; }
  if (segments.some(segment => !segment || segment === '.' || segment === '..' || /[/\\\0]/.test(segment))) return undefined;
  return { key: segments.join('/'), suffix };
}

export function createUrlMapper(options: { urls: Record<string, string>; basePath?: string }): (url: string) => string {
  return value => {
    const reference = assetReference(value, options.basePath ?? '/');
    return reference && Object.prototype.hasOwnProperty.call(options.urls, reference.key)
      ? options.urls[reference.key] + reference.suffix : value;
  };
}

/** Rewrite URL tokens while preserving descriptors, spacing, and data-URL commas. */
export function resolveSrcSet(value: string, resolve: (url: string) => string): string {
  const replacements: { start: number; end: number; value: string }[] = [];
  let index = 0;
  const space = (character: string) => /[\t\n\f\r ]/.test(character);
  while (index < value.length) {
    while (index < value.length && (space(value[index]) || value[index] === ',')) index++;
    const start = index;
    while (index < value.length && !space(value[index])) index++;
    let end = index;
    while (end > start && value[end - 1] === ',') end--;
    if (end > start) {
      const url = value.slice(start, end);
      const resolved = resolve(url);
      if (resolved !== url) replacements.push({ start, end, value: resolved });
    }
    if (end !== index) continue;
    let depth = 0;
    while (index < value.length) {
      if (value[index] === '(') depth++;
      if (value[index] === ')') depth--;
      if (value[index++] === ',' && depth <= 0) break;
    }
  }
  let output = value;
  for (const change of replacements.reverse()) output = output.slice(0, change.start) + change.value + output.slice(change.end);
  return output;
}

export interface AssetUrlResolver {
  managedPaths: readonly string[];
  /** Lookup a literal inventory key, without interpreting URL suffixes or app bases. */
  resolveKey: (key: string) => string | undefined;
  resolve: (url: string) => string;
  resolveSrcSet: (value: string) => string;
  /** All managed assets must be verified before exporting a runtime lookup table. */
  deliveryMap: () => Record<string, string>;
}
export function createAssetUrlResolver(options: {
  manifest: AssetManifest;
  state?: DeploymentState;
  target: StorageTarget;
  publicBaseUrl: string;
  basePath?: string;
  cacheControl?: string;
}): AssetUrlResolver {
  const base = normalizePublicBaseUrl(options.publicBaseUrl);
  if (options.state && (options.state.target.service !== options.target.service ||
      options.state.target.bucket !== options.target.bucket || options.state.target.prefix !== options.target.prefix)) {
    throw new Error('Deployment state belongs to a different storage target');
  }
  const assets = new Map(options.manifest.assets.map(asset => [asset.relativePath, asset]));
  const deployed = new Map(options.state?.assets.map(record => [record.asset.relativePath, record]) ?? []);
  function assetUrl(key: string): string {
    const asset = assets.get(key)!;
    const record = deployed.get(key);
    const remoteKey = options.target.prefix ? `${options.target.prefix}/${asset.storageKey}` : asset.storageKey;
    if (!record || record.status !== 'verified' || !record.verifiedAt || record.key !== remoteKey ||
        record.asset.hash !== asset.hash || record.asset.size !== asset.size ||
        record.asset.mimeType !== asset.mimeType || record.asset.storageKey !== asset.storageKey ||
        options.cacheControl !== undefined && record.cacheControl !== options.cacheControl) {
      throw new Error(`Asset is missing or stale in verified deployment state: ${key}. Run simpcn migrate before building.`);
    }
    // The base already names the uploaded namespace. Do not append the storage prefix again.
    return base + asset.storageKey.split('/').map(encodeURIComponent).join('/');
  }
  const resolve = (value: string): string => {
    const reference = assetReference(value, options.basePath ?? '/');
    return reference && assets.has(reference.key) ? assetUrl(reference.key) + reference.suffix : value;
  };
  return {
    managedPaths: [...assets.keys()],
    resolveKey: key => assets.has(key) ? assetUrl(key) : undefined,
    resolve, resolveSrcSet: value => resolveSrcSet(value, resolve),
    deliveryMap() {
      const urls: Record<string, string> = Object.create(null);
      for (const key of assets.keys()) urls[key] = assetUrl(key);
      return urls;
    },
  };
}
