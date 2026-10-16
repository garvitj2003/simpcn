import { readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createJiti } from 'jiti';
import type { ConfigFlags as Flags } from './config-types.js';
import { resolveStorageTarget as resolveS3Target } from './storage/target.js';
import { normalizePublicBaseUrl } from './delivery.js';

export type UserConfig = Omit<Partial<Config>, 'storage'> & { storage: Partial<Config['storage']> };
export function defineConfig(config: UserConfig): UserConfig { return config; }

export interface Config {
  version: 1;
  root: string;
  exclude: string[];
  storage: { provider: 's3' | 'minio' | 'r2'; bucket: string; region: string; prefix: string; endpoint?: string };
  stateFile: string;
  manifestFile: string;
  concurrency: number;
  hashConcurrency: number;
  maxAttempts: number;
  retryDelayMs: number;
  cacheControl: string;
  publicBaseUrl?: string;
}
const defaults: Config = {
  version: 1, root: 'public', exclude: [], storage: { provider: 's3', bucket: '', region: 'us-east-1', prefix: '' },
  stateFile: '.simpcn/deployment-state.json', manifestFile: '.simpcn/manifest.json',
  concurrency: 4, hashConcurrency: 8, maxAttempts: 3, retryDelayMs: 200,
  cacheControl: 'public, max-age=0, must-revalidate',
};
const fields = new Set([...Object.keys(defaults), 'publicBaseUrl']);
const storageFields = new Set(['provider', 'bucket', 'region', 'prefix', 'endpoint']);
function object(value: unknown, allowed: Set<string>, name: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object`);
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`Unknown ${name} field: ${key}`);
  return value as Record<string, unknown>;
}
function text(value: unknown, name: string, empty = false): string {
  if (typeof value !== 'string' || (!empty && !value.trim()) || /[\r\n\0]/.test(value)) throw new Error(`${name} must be a ${empty ? '' : 'nonempty '}string without control characters`);
  return value;
}
function integer(value: unknown, name: string, min: number, max: number): number {
  const n = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < min || n > max) throw new Error(`${name} must be an integer between ${min} and ${max}`);
  return n;
}
export async function findConfig(cwd: string): Promise<string | undefined> {
  let directory = path.resolve(cwd);
  for (;;) {
    const filename = path.join(directory, 'simpcn.config.ts');
    try { await readFile(filename); return filename; }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    const parent = path.dirname(directory);
    if (parent === directory) return undefined;
    directory = parent;
  }
}
export function resolveConfig(raw: unknown, flags: Flags, directory: string, cwd: string, initializing = false): Config {
  const cfg = object(raw, fields, 'configuration');
  const storage = cfg.storage === undefined ? {} : object(cfg.storage, storageFields, 'storage');
  if (cfg.version !== undefined && cfg.version !== 1) throw new Error('Unsupported configuration version');
  const provider = flags.provider ?? storage.provider ?? defaults.storage.provider;
  if (!['s3', 'minio', 'r2'].includes(provider as string)) throw new Error('provider must be s3, minio or r2');
  const resolvePath = (flag: string | undefined, value: unknown, fallback: string, name: string) =>
    path.resolve(flag === undefined ? directory : cwd, text(flag ?? value ?? fallback, name));
  const endpoint = flags.endpoint ?? storage.endpoint;
  const result: Config = {
    version: 1,
    ...((flags['public-base-url'] ?? cfg.publicBaseUrl) === undefined ? {} : { publicBaseUrl: normalizePublicBaseUrl(text(flags['public-base-url'] ?? cfg.publicBaseUrl, 'publicBaseUrl')) }),
    root: resolvePath(flags.root, cfg.root, defaults.root, 'root'),
    stateFile: resolvePath(flags['state-file'], cfg.stateFile, defaults.stateFile, 'stateFile'),
    manifestFile: resolvePath(flags['manifest-file'], cfg.manifestFile, defaults.manifestFile, 'manifestFile'),
    exclude: (flags.exclude ?? cfg.exclude ?? []) as string[],
    storage: {
      provider: provider as Config['storage']['provider'],
      bucket: text(flags.bucket ?? storage.bucket ?? (initializing ? 'your-bucket' : ''), 'bucket'),
      region: text(flags.region ?? storage.region ?? (provider === 'r2' ? 'auto' : 'us-east-1'), 'region'),
      prefix: text(flags.prefix ?? storage.prefix ?? '', 'prefix', true),
      ...(endpoint === undefined ? {} : { endpoint: text(endpoint, 'endpoint') }),
    },
    concurrency: integer(flags.concurrency ?? cfg.concurrency ?? 4, 'concurrency', 1, 256),
    hashConcurrency: integer(flags['hash-concurrency'] ?? cfg.hashConcurrency ?? 8, 'hashConcurrency', 1, 256),
    maxAttempts: integer(flags['max-attempts'] ?? cfg.maxAttempts ?? 3, 'maxAttempts', 1, 20),
    retryDelayMs: integer(flags['retry-delay-ms'] ?? cfg.retryDelayMs ?? 200, 'retryDelayMs', 0, 30000),
    cacheControl: text(flags['cache-control'] ?? cfg.cacheControl ?? defaults.cacheControl, 'cacheControl'),
  };
  if (!Array.isArray(result.exclude) || result.exclude.some(value => typeof value !== 'string')) throw new Error('exclude must be an array of glob strings');
  if (!initializing && result.storage.provider !== 's3' && !result.storage.endpoint) throw new Error('Set storage.endpoint in simpcn.config.ts; it is required for minio and r2');
  resolveS3Target(result.storage);
  const host = result.storage.endpoint ? new URL(result.storage.endpoint).hostname : '';
  const r2 = host.endsWith('.r2.cloudflarestorage.com');
  const aws = host.endsWith('.amazonaws.com') || host.endsWith('.amazonaws.com.cn');
  if (r2 && provider !== 'r2') throw new Error('This is a Cloudflare R2 endpoint; use provider: r2');
  if (aws && provider !== 's3') throw new Error('This is an AWS endpoint; use provider: s3');
  if (provider === 'r2' && result.storage.region !== 'auto') throw new Error('R2 requires region: auto');
  if (result.stateFile === result.manifestFile || result.stateFile === `${result.manifestFile}.lock` || result.manifestFile === `${result.stateFile}.lock`) throw new Error('State and manifest files must have separate paths');
  for (const filename of [result.stateFile, result.manifestFile]) {
    const relative = path.relative(result.root, filename);
    if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
      throw new Error('State and manifest files must be outside the asset root');
    }
  }
  return result;
}
export async function loadConfig(flags: Flags, cwd: string): Promise<Config> {
  const filename = flags.config ? path.resolve(cwd, flags.config) : await findConfig(cwd);
  let raw = {};
  if (filename) {
    try {
      if (!filename.endsWith('.ts')) throw new Error('Use simpcn.config.ts with a default export');
      raw = await createJiti(import.meta.url, { moduleCache: false, fsCache: false }).import(filename, { default: true });
    }
    catch (error) {
      if (error instanceof SyntaxError) throw new Error(`Invalid TypeScript configuration: ${filename}`);
      throw error;
    }
  }
  return resolveConfig(raw, flags, filename ? path.dirname(filename) : cwd, cwd);
}
export async function initializeConfig(flags: Flags, cwd: string): Promise<string> {
  const filename = path.resolve(cwd, flags.config ?? 'simpcn.config.ts');
  const directory = path.dirname(filename);
  if (!filename.endsWith('.ts')) throw new Error('Config filename must end in .ts');
  let name = path.basename(directory);
  try { name = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8')).name || name; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  name = name.replace(/^@[^/]+\//, '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 63).replace(/-+$/, '');
  if (name.length < 3) name = `${name || 'project'}-assets`;
  if (/^(xn--|sthree-|amzn-s3-demo-)/.test(name) || /(-s3alias|--ol-s3|\.mrap|--x-s3|--table-s3)$/.test(name)) name = `app-${name}`.slice(0, 60) + '-ok';
  const resolved = resolveConfig({}, { ...flags, bucket: flags.bucket ?? name, prefix: flags.prefix ?? 'assets' }, directory, cwd, true);
  const content = { ...resolved, root: path.relative(directory, resolved.root) || '.',
    stateFile: path.relative(directory, resolved.stateFile), manifestFile: path.relative(directory, resolved.manifestFile) };
  await mkdir(directory, { recursive: true });
  // The type-only import also works before the framework package is installed.
  let serialized = JSON.stringify(content, null, 2)
    .replace('  "exclude":', '  // Keep essential assets local: excluded files are not uploaded or rewritten to CDN URLs.\n  // Glob patterns are relative to root (omit "public/"). Your framework still serves these files.\n  // Example: ["favicon.ico", "fonts/**", "offline/**", "images/fallback.png"]\n  "exclude":')
    .replace('    "provider":', '    // Provider selects request addressing and signing defaults.\n    "provider":')
    .replace('    "endpoint":', '    // Storage API origin for uploads, not the public CDN URL.\n    "endpoint":');
  if (!content.storage.endpoint) {
    const example = content.storage.provider === 'r2' ? 'https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com' : 'http://localhost:9000';
    const note = content.storage.provider === 's3' ? 'Optional: AWS selects the API endpoint from region.' : 'Required: uncomment and enter your storage API origin before migration.';
    serialized = serialized.replace('"storage": {', `"storage": {\n    // ${note}\n    // This is the upload API, not the public asset URL.\n    // endpoint: "${example}",`);
  }
  const isR2 = content.storage.provider === 'r2';
  let publicNote = content.publicBaseUrl ? '' : '\n  // Required for production builds; include your asset prefix. Never auto-derived.\n  // publicBaseUrl: "https://cdn.example.com/assets/",\n';
  if (isR2) {
    serialized = serialized.replace('"storage": {', '"storage": {\n    // R2: remove /bucket-name from the copied S3 API URL.\n    // Use only https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com; set the bucket separately below.');
    const prefix = content.storage.prefix.replace(/\/+$/, '');
    const publicExample = `https://pub-YOUR_ID.r2.dev/${prefix ? prefix.split('/').map(encodeURIComponent).join('/') + '/' : ''}`;
    const guidance = '  // R2: append the storage.prefix directory to your public bucket URL.\n' +
      `  // Example for this prefix: ${publicExample}\n` +
      '  // If prefix is empty, use the public bucket URL without a directory suffix.\n';
    if (content.publicBaseUrl) serialized = serialized.replace('  "publicBaseUrl":', guidance + '  "publicBaseUrl":');
    else publicNote = '\n  // Required for production builds.\n' + guidance + `  // publicBaseUrl: ${JSON.stringify(publicExample)},\n`;
  }
  const source = 'import type { UserConfig } from "simpcn";\n\nexport default ' + serialized.slice(0, -1).trimEnd() + ',\n' + publicNote + '} satisfies UserConfig;\n';
  try { await writeFile(filename, source, { flag: flags.force ? 'w' : 'wx' }); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('Configuration already exists; use init --force to replace it');
    throw error;
  }
  return filename;
}
