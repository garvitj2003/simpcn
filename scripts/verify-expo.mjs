// Real Expo builds in a disposable consumer, never an app in this workspace.
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { png as createPng } from '../packages/expo/test/png.mjs';
const exec = promisify(execFile);
const repo = fileURLToPath(new URL('../', import.meta.url));
const version = JSON.parse(await readFile(path.join(repo, 'packages/cli/package.json'), 'utf8')).version;
const archive = name => path.join(repo, 'artifacts/expo', `${name}-${version}.tgz`);
const cwd = await mkdtemp(path.join(tmpdir(), 'simpcn-expo-proof-'));
const run = async (args, extra = {}) => {
  try { return await exec('pnpm', ['--dir', cwd, ...args], { env: { ...process.env, CI: '1', EXPO_NO_TELEMETRY: '1' }, maxBuffer: 8 * 1024 * 1024, timeout: 180000, ...extra }); }
  catch (error) { throw new Error(`${error.stdout ?? ''}\n${error.stderr ?? ''}`, { cause: error }); }
};
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
async function files(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await files(filename)); else result.push(filename);
  }
  return result;
}
async function config(host = 'cdn.example.com') {
  await writeFile(path.join(cwd, 'simpcn.config.ts'), `export default {root:'assets/cdn',exclude:['local.png','essential@2x.png'],storage:{bucket:'test',prefix:'release-proof'},publicBaseUrl:'https://${host}/release-proof/'};`);
}
async function exportNative(platform, output) {
  const result = await run(['exec', 'expo', 'export', '--platform', platform, '--max-workers', '1', '--no-bytecode', '--no-minify', '--dump-assetmap', '--output-dir', output]);
  const filenames = await files(path.join(cwd, output));
  const bundles = filenames.filter(file => file.endsWith('.js'));
  assert.ok(bundles.length, 'Expo must emit JavaScript bundles');
  return { code: (await Promise.all(bundles.map(file => readFile(file, 'utf8')))).join('\n'),
    map: JSON.parse(await readFile(path.join(cwd, output, 'assetmap.json'), 'utf8')), log: result.stdout };
}
try {
  await writeFile(path.join(cwd, 'package.json'), JSON.stringify({ name: 'simpcn-expo-proof', private: true, version: '0.0.0', main: 'index.js',
    dependencies: { expo: '58.0.14', 'expo-image': '58.0.15', react: '19.3.0', 'react-native': '0.88.0', '@simpcn/core': 'file:' + archive('simpcn-core'), simpcn: 'file:' + archive('simpcn') } }));
  await writeFile(path.join(cwd, 'pnpm-workspace.yaml'), `overrides:\n  '@simpcn/core': ${JSON.stringify('file:' + archive('simpcn-core'))}\n`);
  await run(['install', '--no-frozen-lockfile', '--ignore-scripts']);
  const metroSource = `const {getDefaultConfig}=require('expo/metro-config');const {withSimpcn}=require('@simpcn/expo/metro');module.exports=withSimpcn(getDefaultConfig(__dirname));`;
  await writeFile(path.join(cwd, 'metro.config.js'), metroSource);
  const initialized = JSON.parse((await run(['exec', 'simpcn', 'init', '--framework', 'expo', '--yes', '--integration-package', archive('simpcn-expo'), '--json'])).stdout);
  assert.equal(initialized.framework, 'expo');
  assert.equal(await readFile(path.join(cwd, 'metro.config.js'), 'utf8'), metroSource);
  assert.ok((await readFile(path.join(cwd, 'simpcn.config.ts'), 'utf8')).includes('assets/cdn'));
  assert.ok((await readFile(path.join(cwd, '.gitignore'), 'utf8')).includes('simpcn/.build/'));
  const consumerRequire = createRequire(path.join(cwd, 'package.json'));
  assert.equal(typeof consumerRequire('@simpcn/expo/metro').withSimpcn, 'function');
  const coreApi = path.join(cwd, 'core-api.mjs');
  await writeFile(coreApi, "export { generateManifest } from '@simpcn/core';\n");
  const { generateManifest } = await import(pathToFileURL(coreApi).href);
  const adapter = JSON.parse(await readFile(path.join(cwd, 'node_modules/@simpcn/expo/package.json'), 'utf8'));
  assert.notEqual(adapter.private, true, 'Release adapter must be publishable');
  assert.equal(adapter.version, version);
  assert.deepEqual(Object.keys(adapter.dependencies), ['@simpcn/core']);
  await assert.rejects(readFile(path.join(cwd, 'node_modules/@simpcn/expo/test/adapter.test.ts')));
  console.log('Packed CLI init, local adapter installation, CommonJS Metro entry and package contents passed.');
  await mkdir(path.join(cwd, 'assets/cdn'), { recursive: true });
  await mkdir(path.join(cwd, 'simpcn'), { recursive: true });
  const images = {
    'remote.png': [12, 8], 'imported.png': [10, 10], 'mixed.png': [10, 10], 'local.png': [12, 8],
    'family.png': [24, 12], 'family@2x.png': [48, 24], 'family@3x.png': [72, 36],
    'platform.png': [8, 8], 'platform.ios.png': [20, 10], 'platform@2x.ios.png': [40, 20], 'platform.android.png': [30, 15],
    'only@2x.png': [48, 24], 'only@3x.png': [72, 36], 'essential.png': [10, 10], 'essential@2x.png': [20, 20],
  };
  let color = 30;
  for (const [name, [width, height]] of Object.entries(images)) await writeFile(path.join(cwd, 'assets/cdn', name), createPng(width, height, color++));
  await writeFile(path.join(cwd, 'app.json'), JSON.stringify({ expo: { name: 'Simpcn integration proof', slug: 'simpcn-proof', platforms: ['ios', 'android'] } }));
  await writeFile(path.join(cwd, 'index.js'), `import React from 'react';import {registerRootComponent} from 'expo';import {Image,ImageBackground,View} from 'react-native';import {Image as ExpoImage} from 'expo-image';
import imported from './assets/cdn/imported.png';import family from './assets/cdn/family.png';import mixed from './assets/cdn/mixed.png';import local from './assets/cdn/local.png';
globalThis.__simpcnKeepLocal=mixed;
function App(){return <View><Image source={require('./assets/cdn/remote.png')}/><ImageBackground source={require('./assets/cdn/remote.png')}/><ExpoImage source={require('./assets/cdn/remote.png')}/><Image source={local}/><Image source={family}/><ExpoImage source={family}/><Image source={imported}/><Image source={mixed}/><Image source={require('./assets/cdn/platform.png')}/><Image source={require('./assets/cdn/only.png')}/><Image source={require('./assets/cdn/essential.png')}/></View>};registerRootComponent(App);`);
  await config();
  const manifest = await generateManifest({ root: path.join(cwd, 'assets/cdn'), exclude: ['local.png', 'essential@2x.png'] });
  await writeFile(path.join(cwd, 'simpcn/deployment-state.json'), JSON.stringify({ version: 1, target: { service: 'aws-s3:us-east-1', bucket: 'test', prefix: 'release-proof' }, assets: manifest.assets.map(asset => ({ asset, key: 'release-proof/' + asset.storageKey, status: 'verified', verifiedAt: 'fixture', cacheControl: 'public, max-age=0, must-revalidate' })) }));
  for (const platform of ['android', 'ios']) {
    const { code, map } = await exportNative(platform, `dist/${platform}`);
    assert.ok(code.includes('https://cdn.example.com/release-proof/remote.png'));
    const assetMap = JSON.stringify(map);
    assert.ok(!assetMap.includes('/remote.png'), 'Rewritten image must be absent from the asset graph');
    for (const name of ['local.png', 'mixed.png', 'essential.png', 'essential@2x.png']) assert.ok(assetMap.includes(name), `Local asset ${name} must remain in the graph`);
    for (const name of ['imported.png', 'family.png', 'family@2x.png', 'family@3x.png', `platform.${platform}.png`, 'only@2x.png']) assert.ok(!assetMap.includes('/' + name), `CDN asset ${name} must leave the graph`);
    for (const name of ['imported.png', 'mixed.png', 'family.png', 'family@2x.png', 'family@3x.png', 'only@2x.png', 'only@3x.png', `platform.${platform}.png`]) assert.ok(code.includes('https://cdn.example.com/release-proof/' + encodeURIComponent(name)), `Missing CDN source for ${name}`);
    assert.ok(!code.includes('https://cdn.example.com/release-proof/platform.' + (platform === 'ios' ? 'android' : 'ios') + '.png'));
    assert.ok(code.includes('selectImageSource'), 'Density selection must execute in the mobile bundle');
    assert.ok(!code.includes('createAssetUrlResolver'), 'Build-only core must not enter the bundle');
    console.log(`${platform}: verified CDN source emitted; static imports and variant CDN sources emitted; local/mixed-use assets retained.`);
  }
  // Same Metro cache, changed configuration. No --clear anywhere in this proof.
  await config('cdn2.example.com');
  const changed = await exportNative('android', 'dist/warm');
  assert.ok(changed.code.includes('https://cdn2.example.com/release-proof/remote.png'));
  assert.ok(!changed.code.includes('https://cdn.example.com/release-proof/remote.png'));
  await writeFile(path.join(cwd, 'assets/cdn/remote.png'), Buffer.concat([png, Buffer.from('changed bytes')]));
  await assert.rejects(exportNative('android', 'dist/stale'), /missing or stale/);
  console.log('Warm-cache URL change and stale-byte rejection passed.');
  const versions = {};
  for (const name of ['expo', 'expo-image', 'react', 'react-native']) versions[name] = JSON.parse(await readFile(path.join(cwd, 'node_modules', name, 'package.json'), 'utf8')).version;
  console.log('Pinned fixture:', JSON.stringify(versions));
} finally {
  if (process.env.SIMPCN_KEEP_EXPO_FIXTURE === '1') console.log('Retained fixture:', cwd);
  else { await rm(cwd, { recursive: true, force: true }); console.log('Temporary Expo fixture removed.'); }
}
