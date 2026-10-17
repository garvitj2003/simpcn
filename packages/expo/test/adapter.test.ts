import { afterEach, beforeEach, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { generateManifest } from '@simpcn/core';
import { png as createPng } from './png.mjs';
const require = createRequire(import.meta.url);
const { transformSync } = require('@babel/core');
const plugin = require('../src/plugin.cjs');
const { withSimpcn } = require('../src/metro.cjs');
const { imageSize } = require('../src/image.cjs');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
let cwd: string;
beforeEach(async () => { cwd = await mkdtemp(path.join(tmpdir(), 'simpcn-expo-unit-')); });
afterEach(async () => { await rm(cwd, { recursive: true, force: true }); });
function transform(source: string, entries: object) {
  return transformSync(source, { filename: path.join(cwd, 'App.tsx'), configFile: false, babelrc: false,
    parserOpts: { plugins: ['jsx', 'typescript'] }, plugins: [[plugin, { entries }]] }).code;
}
const app = (source = "require('./assets/a.png')", name = 'Picture') => `import {Image as Picture} from 'react-native'; export default <${name} source={${source}}/>;`;
it('rewrites only binding-verified consumers and removes the image dependency', () => {
  const entries = { [path.join(cwd, 'assets/a.png')]: { source: { uri: 'https://cdn.test/release/a.png', width: 1, height: 1, scale: 1 } } };
  for (const source of [app(), app().replace("'react-native'", "'expo-image'"), app().replace('Image as', 'ImageBackground as')]) {
    const output = transform(source, entries);
    expect(output).toContain('https://cdn.test/release/a.png');
    expect(output).not.toContain('require(');
    expect(output).toContain('width: 1');
  }
});
it('preserves shadowed names, unsupported uses, spreads and excluded paths', () => {
  const entries = { [path.join(cwd, 'assets/a.png')]: { error: 'must not be reached' } };
  const cases = [
    app().replace("'react-native'", "'custom-wrapper'"),
    app().replace('source={', '{...props} source={'),
    app().replace('source={', 'source={null} source={'),
    app("require(name)"), app("require('./assets/excluded.png')"),
    `import {Image as Picture} from 'react-native'; function Screen(Picture) {return <Picture source={require('./assets/a.png')}/>}`,
    `import {Image as Picture} from 'react-native'; function Screen(require) {return <Picture source={require('./assets/a.png')}/>}`,
    `import {Image as Picture} from 'react-native'; const x=<Picture defaultSource={require('./assets/a.png')}/>;`,
  ];
  for (const source of cases) expect(() => transform(source, entries)).not.toThrow();
  expect(transform(cases[1], entries)).toContain('require(');
});
it('keeps code locations on rewritten AST nodes through the upstream Babel pass', () => {
  const filename = path.join(cwd, 'App.tsx');
  const result = transformSync(app(), { filename, configFile: false, babelrc: false, sourceMaps: true,
    parserOpts: { plugins: ['jsx'] }, plugins: [[plugin, { entries: { [path.join(cwd, 'assets/a.png')]: { source: { uri: 'https://cdn.test/a.png' } } } }]] });
  expect(result.map.sourcesContent[0]).toBe(app());
  expect(result.map.mappings).not.toBe('');
});
async function fixture() {
  await mkdir(path.join(cwd, 'assets'));
  await writeFile(path.join(cwd, 'assets/a.png'), png);
  await writeFile(path.join(cwd, 'assets/local.png'), png);
  await writeFile(path.join(cwd, 'simpcn.config.ts'), `export default {root:'assets',exclude:['local.png'],storage:{bucket:'test',prefix:'release-1'},publicBaseUrl:'https://cdn.test/release-1/'};`);
  const manifest = await generateManifest({ root: path.join(cwd, 'assets'), exclude: ['local.png'] });
  await mkdir(path.join(cwd, 'simpcn'));
  await writeFile(path.join(cwd, 'simpcn/deployment-state.json'), JSON.stringify({ version: 1, target: { service: 'aws-s3:us-east-1', bucket: 'test', prefix: 'release-1' }, assets: manifest.assets.map(asset => ({ asset, key: 'release-1/' + asset.storageKey, status: 'verified', verifiedAt: 'fixture', cacheControl: 'public, max-age=0, must-revalidate' })) }));
  const upstream = path.join(cwd, 'upstream.cjs');
  await writeFile(upstream, `const babel=require(${JSON.stringify(require.resolve('@babel/core'))}); module.exports={getCacheKey:()=> 'upstream-key',transform(args){return babel.transformSync(args.src,{filename:args.filename,configFile:false,babelrc:false,parserOpts:{plugins:['jsx']},plugins:args.plugins||[]});}};`);
  return { projectRoot: cwd, resolver: { assetExts: ['png'] }, transformer: { babelTransformerPath: upstream, customValue: true } };
}
it('passes immutable worker configuration, delegates custom transformers and bypasses dev/web', async () => {
  const original = await fixture();
  const wrapped = await withSimpcn(original);
  expect(wrapped.resolver).toBe(original.resolver);
  expect(wrapped.transformer.customValue).toBe(true);
  const worker = require(wrapped.transformer.babelTransformerPath);
  const args = { filename: path.join(cwd, 'App.jsx'), src: app(), options: { dev: false, platform: 'android' } };
  expect(worker.transform(args).code).toContain('https://cdn.test/release-1/a.png');
  expect(worker.transform({ ...args, options: { dev: true, platform: 'android' } }).code).toContain('require(');
  expect(worker.transform({ ...args, options: { dev: false, platform: 'web' } }).code).toContain('require(');
  expect(worker.getCacheKey()).toContain('upstream-key');
  expect(worker.transform({ ...args, src: app("require('./assets/local.png')") }).code).toContain('require(');
});
it('changes the cache namespace when assets, state, config or public URL changes and rejects stale verification', async () => {
  const config = await fixture();
  const first = await withSimpcn(config);
  await writeFile(path.join(cwd, 'assets/a.png'), Buffer.concat([png, Buffer.from('changed')]));
  const stale = await withSimpcn(config);
  expect(stale.cacheVersion).not.toBe(first.cacheVersion);
  const worker = require(stale.transformer.babelTransformerPath);
  expect(() => worker.transform({ filename: path.join(cwd, 'App.jsx'), src: app(), options: { dev: false, platform: 'ios' } })).toThrow(/missing or stale/);
  const filename = path.join(cwd, 'simpcn.config.ts');
  await writeFile(filename, (await readFile(filename, 'utf8')).replace('cdn.test', 'cdn2.test'));
  expect((await withSimpcn(config)).cacheVersion).not.toBe(stale.cacheVersion);
  await rm(path.join(cwd, 'simpcn/deployment-state.json'));
  const missing = await withSimpcn(config);
  expect(missing.cacheVersion).not.toBe(stale.cacheVersion);
  expect(require(missing.transformer.babelTransformerPath).transform({ filename: path.join(cwd, 'App.jsx'), src: app(), options: { dev: true, platform: 'ios' } }).code).toContain('require(');
});
it('keeps a density family local when a selected sibling is excluded', async () => {
  const config = await fixture();
  await writeFile(path.join(cwd, 'assets/a@2x.png'), png);
  const filename = path.join(cwd, 'simpcn.config.ts');
  await writeFile(filename, (await readFile(filename, 'utf8')).replace("['local.png']", "['local.png','a@2x.png']"));
  const wrapped = await withSimpcn(config);
  const worker = require(wrapped.transformer.babelTransformerPath);
  expect(worker.transform({ filename: path.join(cwd, 'App.jsx'), src: app(), options: { dev: false, platform: 'ios' } }).code).toContain('require(');
});
it('reads PNG and JPEG sizes and rejects truncated metadata', () => {
  expect(imageSize(png)).toEqual({ width: 1, height: 1 });
  const jpeg = Buffer.from([255,216,255,192,0,8,8,0,2,0,3,1]);
  expect(imageSize(jpeg)).toEqual({ width: 3, height: 2 });
  expect(() => imageSize(png.subarray(0, 20))).toThrow();
  expect(() => imageSize(jpeg.subarray(0, 8))).toThrow();
});

it('rewrites default image imports and removes only bindings whose supported uses were replaced', () => {
  const entries = { [path.join(cwd, 'assets/a.png')]: { source: { uri: 'https://cdn.test/a.png', width: 1, height: 1, scale: 1 } } };
  const source = `import {Image as Picture} from 'react-native'; import logo from './assets/a.png'; const x=<><Picture source={logo}/><Picture source={logo}/></>;`;
  const rewritten = transform(source, entries);
  expect(rewritten).not.toContain("from './assets/a.png'");
  expect(rewritten.match(/https:\/\/cdn.test\/a.png/g)).toHaveLength(2);
  const mixed = transform(source + 'console.log(logo);', entries);
  expect(mixed).toContain("from './assets/a.png'");
  expect(mixed).toContain('console.log(logo)');
  const shadowed = transform(source + 'function Other(logo){return <Picture source={logo}/>}', entries);
  expect(shadowed).not.toContain("from './assets/a.png'");
  expect(shadowed).toContain('source={logo}');
  const unused = transform(`import logo from './assets/a.png'; export default 1;`, entries);
  expect(unused).toContain("from './assets/a.png'");
});
it('retains an import used in a fallback, unsupported wrapper, or spread-prop image', () => {
  const entries = { [path.join(cwd, 'assets/a.png')]: { source: { uri: 'https://cdn.test/a.png' } } };
  const source = `import {Image} from 'react-native';import logo from './assets/a.png';const a=<Image source={logo}/>;`;
  for (const extra of ['const b=<Image defaultSource={logo}/>;', 'const b=<Wrapper source={logo}/>;', 'const b=<Image {...props} source={logo}/>;']) {
    const output = transform(source + extra, entries);
    expect(output).toContain("from './assets/a.png'");
    expect(output).toContain('https://cdn.test/a.png');
  }
});
const { buildFamilies } = require('../src/families.cjs');
const { selectImageSource } = require('../src/runtime.cjs');
async function families(images: Record<string, [number, number]>, excluded: string[] = []) {
  for (const [name, [width, height]] of Object.entries(images)) await writeFile(path.join(cwd, name), createPng(width, height));
  return buildFamilies({ root: cwd, files: Object.keys(images).map(relativePath => ({ relativePath })), managed: new Set(Object.keys(images).filter(key => !excluded.includes(key))), resolver: { resolveKey: (key: string) => 'https://cdn.test/' + encodeURIComponent(key) } });
}
it('selects density at runtime with logical dimensions and supports a missing base file', async () => {
  const entries = await families({ 'icon@2x.png': [48, 24], 'icon@3x.png': [72, 36] });
  const sources = entries.ios[path.join(cwd, 'icon.png')].sources;
  expect(sources.map((s: any) => [s.width, s.height, s.scale])).toEqual([[24,12,2],[24,12,3]]);
  for (const [density, selected] of [[1,2],[1.5,2],[2,2],[2.1,3],[3,3],[4,3]]) expect(selectImageSource(sources, density).scale).toBe(selected);
  expect(entries.android[path.join(cwd, 'icon.png')]).toEqual(entries.ios[path.join(cwd, 'icon.png')]);
});
it('uses platform density families without mixing generic densities into them', async () => {
  const entries = await families({ 'icon.png': [10,10], 'icon@3x.png': [30,30], 'icon.ios.png': [20,10], 'icon@2x.ios.png': [40,20], 'icon.android.png': [30,15] });
  const ios = entries.ios[path.join(cwd, 'icon.png')].sources;
  expect(ios.map((s: any) => [s.scale, s.width, s.height])).toEqual([[1,20,10],[2,20,10]]);
  expect(ios[1].uri).toContain('icon%402x.ios.png');
  expect(entries.android[path.join(cwd, 'icon.png')].source).toMatchObject({ uri: 'https://cdn.test/icon.android.png', width: 30, height: 15 });
});
it('falls back to the generic family and respects explicitly requested platform names', async () => {
  const entries = await families({ 'icon.png': [10,10], 'icon@2x.png': [20,20], 'icon.ios.png': [14,14] });
  expect(entries.android[path.join(cwd, 'icon.png')].sources).toHaveLength(2);
  expect(entries.ios[path.join(cwd, 'icon.png')].source.width).toBe(14);
  expect(entries.android[path.join(cwd, 'icon.ios.png')].source.width).toBe(14);
});
it('rejects inconsistent dimensions, duplicate density and stale siblings before generating remote sources', async () => {
  let entries = await families({ 'icon.png': [10,10], 'icon@2x.png': [21,20] });
  expect(entries.ios[path.join(cwd, 'icon.png')].error).toMatch(/logical dimensions/);
  entries = await families({ 'dup.png': [10,10], 'dup@1x.png': [10,10] });
  expect(entries.android[path.join(cwd, 'dup.png')].error).toMatch(/duplicate/);
  const files = ['ok.png', 'ok@2x.png'];
  for (const name of files) await writeFile(path.join(cwd, name), createPng(name.includes('@') ? 20 : 10, name.includes('@') ? 20 : 10));
  entries = await buildFamilies({ root: cwd, files: files.map(relativePath => ({ relativePath })), managed: new Set(files), resolver: { resolveKey(key: string) { if (key.includes('@')) throw Error('missing or stale sibling'); return 'https://cdn.test/' + key; } } });
  expect(entries.ios[path.join(cwd, 'ok.png')].error).toMatch(/stale sibling/);
});
it('leaves the selected family local when a sibling is excluded, and defers native variants', async () => {
  const entries = await families({ 'icon.png': [10,10], 'icon@2x.png': [20,20], 'other.png': [10,10], 'other.native.png': [10,10] }, ['icon@2x.png']);
  expect(entries.ios[path.join(cwd, 'icon.png')]).toBeUndefined();
  expect(entries.android[path.join(cwd, 'other.png')]).toBeUndefined();
  expect(entries.ios[path.join(cwd, 'other.native.png')]).toBeUndefined();
});
it('injects a collision-free mobile selector only for multiple densities', () => {
  const source = `import {Image} from 'react-native';const _simpcnImageSource=1;const x=<Image source={require('./assets/a.png')}/>;`;
  const result = transformSync(source, { filename: path.join(cwd, 'App.jsx'), configFile: false, babelrc: false, parserOpts: { plugins: ['jsx'] }, plugins: [[plugin, { runtime: '/generated/runtime.cjs', entries: { [path.join(cwd, 'assets/a.png')]: { sources: [{ uri: 'https://cdn.test/a.png', scale: 1 }, { uri: 'https://cdn.test/a@2x.png', scale: 2 }] } } }]] }).code;
  expect(result).toContain('selectImageSource as _simpcnImageSource2');
  expect(result).toContain('_simpcnImageSource2([');
});
it('invalidates the worker snapshot and rejects an unverified new density sibling', async () => {
  const config = await fixture();
  const first = await withSimpcn(config);
  await writeFile(path.join(cwd, 'assets/a@2x.png'), createPng(2, 2));
  const second = await withSimpcn(config);
  expect(second.cacheVersion).not.toBe(first.cacheVersion);
  const args = { filename: path.join(cwd, 'App.jsx'), src: app(), options: { dev: false, platform: 'android' } };
  expect(() => require(second.transformer.babelTransformerPath).transform(args)).toThrow(/missing or stale/);
  const stateFile = path.join(cwd, 'simpcn/deployment-state.json');
  const state = JSON.parse(await readFile(stateFile, 'utf8'));
  const manifest = await generateManifest({ root: path.join(cwd, 'assets'), exclude: ['local.png'] });
  state.assets = manifest.assets.map(asset => ({ asset, key: 'release-1/' + asset.storageKey, status: 'verified', verifiedAt: 'fixture', cacheControl: 'public, max-age=0, must-revalidate' }));
  await writeFile(stateFile, JSON.stringify(state));
  const third = await withSimpcn(config);
  expect(third.cacheVersion).not.toBe(second.cacheVersion);
  const code = require(third.transformer.babelTransformerPath).transform(args).code;
  expect(code).toContain('https://cdn.test/release-1/a%402x.png');
  expect(code).toContain('selectImageSource');
});
it('keeps static image imports intact during development', async () => {
  const config = await fixture();
  const wrapped = await withSimpcn(config);
  const src = `import {Image} from 'react-native';import logo from './assets/a.png';const x=<Image source={logo}/>;`;
  const output = require(wrapped.transformer.babelTransformerPath).transform({ filename: path.join(cwd, 'App.jsx'), src, options: { dev: true, platform: 'ios' } }).code;
  expect(output).toContain("from './assets/a.png'");
  expect(output).toContain('source={logo}');
  expect(output).not.toContain('https://cdn.test');
});
it('the generated mobile selector reaches only React Native and uses its device density', async () => {
  const { runInNewContext } = await import('node:vm');
  const moduleExports: Record<string, any> = {};
  const requests: string[] = [];
  runInNewContext(await readFile(require.resolve('../src/runtime.cjs'), 'utf8'), { exports: moduleExports, require(name: string) { requests.push(name); if (name !== 'react-native') throw Error('Unexpected mobile dependency'); return { PixelRatio: { get: () => 2.625 } }; } });
  expect(moduleExports.selectImageSource([{ scale: 1 }, { scale: 2 }, { scale: 3 }]).scale).toBe(3);
  expect(requests).toEqual(['react-native']);
});
