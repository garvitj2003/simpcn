import { beforeEach, afterEach, it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { generateManifest } from '@simpcn/core';
import { withSimpcn } from '../src/index.js';
import { mapResolver } from '../src/map.js';
import { transformJs } from '@simpcn/transforms';

let cwd: string;
const context = { defaultConfig: {} };
it('supports CommonJS package exports used by TypeScript Next configs', async () => {
  const require = createRequire(import.meta.url);
  const entry = require('@simpcn/next');
  const original = { basePath: '/docs', cacheComponents: true };
  expect(await entry.withSimpcn(original)('phase-development-server', context)).toBe(original);
  expect(require('@simpcn/next/assets').assetUrl('/logo.svg')).toBe('/logo.svg');
});
beforeEach(async () => {
  cwd = await mkdtemp(path.join(tmpdir(), 'simpcn-next-config-'));
  await mkdir(path.join(cwd, 'public'));
  await writeFile(path.join(cwd, 'public/logo.svg'), '<svg/>');
  await writeFile(path.join(cwd, 'simpcn.config.ts'), "export default {storage:{bucket:'test'},publicBaseUrl:'https://cdn.example.com/assets/'}");
});
afterEach(async () => { await rm(cwd, { recursive: true, force: true }); });
async function state() {
  const manifest = await generateManifest({ root: path.join(cwd, 'public') });
  await mkdir(path.join(cwd, '.simpcn'), { recursive: true });
  await writeFile(path.join(cwd, '.simpcn/deployment-state.json'), JSON.stringify({ version: 1, target: { service: 'aws-s3:us-east-1', bucket: 'test', prefix: '' }, assets: manifest.assets.map(asset => ({ asset, key: asset.storageKey, status: 'verified', verifiedAt: 'fixture', cacheControl: 'public, max-age=0, must-revalidate' })) }));
}
it('development and deployed server config do not require local build inputs', async () => {
  const original = { basePath: '/docs' };
  expect(await withSimpcn(original, { cwd: '/missing-build-machine' })('phase-development-server', context)).toBe(original);
  expect(await withSimpcn(original, { cwd: '/missing-build-machine' })('phase-production-server', context)).toBe(original);
});
it('fails CI builds for missing or stale verification rather than falling back to local URLs', async () => {
  await expect(withSimpcn({}, { cwd })('phase-production-build', context)).rejects.toThrow('missing or stale');
  await state();
  await writeFile(path.join(cwd, 'public/logo.svg'), 'changed');
  await expect(withSimpcn({}, { cwd })('phase-production-build', context)).rejects.toThrow('missing or stale');
});
it('requires explicit publicBaseUrl and rejects legacy JSON config', async () => {
  await writeFile(path.join(cwd, 'simpcn.config.ts'), "export default {storage:{bucket:'test'}}");
  await expect(withSimpcn({}, { cwd })('phase-production-build', context)).rejects.toThrow('publicBaseUrl');
  await expect(withSimpcn({}, { cwd, config: 'config.json' })('phase-production-build', context)).rejects.toThrow('simpcn.config.ts');
});
it('preserves async user config, aliases, rules, assetPrefix and user webpack hook', async () => {
  await state();
  const result = await withSimpcn(async () => ({ assetPrefix: 'https://chunks.example.com', basePath: '/docs',
    turbopack: { resolveAlias: { existing: './existing.js' }, rules: { '*.jsx': { loaders: ['existing-loader'] } } },
    webpack: config => ({ ...config, marker: true }),
  }), { cwd })('phase-production-build', context);
  expect(result.assetPrefix).toBe('https://chunks.example.com');
  expect(result.turbopack?.resolveAlias?.existing).toBe('./existing.js');
  expect(result.turbopack?.rules?.['*.jsx']).toHaveLength(2);
  const compiled = await result.webpack!({}, {} as any);
  expect(compiled.marker).toBe(true);
  expect(compiled.module.rules[0].enforce).toBe('pre');
  expect(JSON.stringify(compiled.module.rules[0].use[0].options)).not.toMatch(/verifiedAt|bucket|credentials/);
});
it('the source loader preserves directives, suffixes and unrelated strings', () => {
  const source = `'use client';const route='/logo.svg';export default () => <><img src="/docs/logo.svg?v=1#shape"/><a href="/logo.svg">route</a></>`;
  const result = transformJs(source, 'component.tsx', mapResolver({ urls: { 'logo.svg': 'https://cdn.example.com/assets/logo.svg' }, basePath: '/docs' }), () => {})!;
  expect(result.code.startsWith("'use client'")).toBe(true);
  expect(result.code).toContain('https://cdn.example.com/assets/logo.svg?v=1#shape');
  expect(result.code).toContain("const route='/logo.svg'");
  expect(result.code).toContain('<a href="/logo.svg">');
  expect(result.map.sourcesContent).toEqual([source]);
});
it('does not silently change explicit next/image optimization configuration', () => {
  const source = `import Image from 'next/image';export default () => <Image src="/logo.svg" unoptimized={false} width={20} height={20}/>`;
  expect(transformJs(source, 'component.tsx', mapResolver({ urls: { 'logo.svg': 'https://cdn.example.com/assets/logo.svg' }, basePath: '/' }), () => {}, { nextImages: true })).toBeNull();
});
