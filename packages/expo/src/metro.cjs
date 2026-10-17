'use strict';
const path = require('node:path');
const { createRequire } = require('node:module');
const { readFile, mkdir, writeFile } = require('node:fs/promises');
const { createHash } = require('node:crypto');
const { buildFamilies } = require('./families.cjs');
const hash = value => createHash('sha256').update(value).digest('hex');

/** Experimental: return the promise from metro.config.js. No runtime entry. */
exports.withSimpcn = async function withSimpcn(config, options = {}) {
  config = await config;
  const cwd = path.resolve(options.cwd ?? config.projectRoot ?? process.cwd());
  const core = await import('@simpcn/core');
  const settings = await core.loadConfig({}, cwd);
  const manifest = await core.generateManifest({ root: settings.root, exclude: settings.exclude, concurrency: settings.hashConcurrency });
  let stateText = '';
  try { stateText = await readFile(settings.stateFile, 'utf8'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  let resolver, setupError;
  try {
    if (!settings.storage.prefix) throw new Error('Use an immutable release prefix and matching publicBaseUrl for native builds.');
    if (!settings.publicBaseUrl) throw new Error('Set publicBaseUrl before building.');
    resolver = core.createAssetUrlResolver({ manifest, target: core.resolveStorageTarget(settings.storage),
      state: stateText ? JSON.parse(stateText) : undefined, publicBaseUrl: settings.publicBaseUrl, cacheControl: settings.cacheControl });
  } catch (error) { setupError = error.message; }
  const all = await core.scanAssets({ root: settings.root });
  const entries = await buildFamilies({ root: settings.root, files: all,
    managed: new Set(manifest.assets.map(asset => asset.relativePath)), resolver, setupError });
  const projectRequire = createRequire(path.join(cwd, 'package.json'));
  const upstream = config.transformer?.babelTransformerPath ?? projectRequire.resolve('@expo/metro-config/babel-transformer');
  const implementation = await Promise.all(['metro.cjs', 'worker.cjs', 'plugin.cjs', 'image.cjs', 'families.cjs', 'runtime.cjs'].map(file => readFile(path.join(__dirname, file), 'utf8')));
  const digest = hash(JSON.stringify({ settings, assets: manifest.assets, stateText, entries, upstream, implementation }));
  const directory = path.join(cwd, 'simpcn', '.build', 'expo');
  await mkdir(directory, { recursive: true });
  const runtime = path.join(directory, `image-source-${digest}.cjs`);
  await writeFile(runtime, await readFile(path.join(__dirname, 'runtime.cjs')));
  const snapshot = { entries, digest, runtime };
  const transformer = path.join(directory, `transformer-${digest}.cjs`);
  await writeFile(transformer, `module.exports = require(${JSON.stringify(require.resolve('./worker.cjs'))}).createTransformer(${JSON.stringify(upstream)}, ${JSON.stringify(snapshot)});\n`);
  return { ...config, cacheVersion: `${config.cacheVersion ?? ''}:simpcn:${digest}`,
    transformer: { ...config.transformer, babelTransformerPath: transformer } };
};
