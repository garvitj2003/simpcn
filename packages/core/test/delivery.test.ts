import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import { createAssetUrlResolver, createUrlMapper, normalizePublicBaseUrl, resolveSrcSet } from '../src/delivery.js';
import { resolveConfig } from '../src/config.js';
import type { AssetManifest, AssetRecord, DeploymentState } from '../src/index.js';
const target = { service: 'minio', bucket: 'test', prefix: 'mvp' };
const asset = (relativePath: string): AssetRecord => ({ relativePath, storageKey: relativePath,
  size: 5, hash: createHash('sha256').update(relativePath).digest('hex'), mimeType: 'image/png' });
const manifest: AssetManifest = { version: 1, assets: [asset('images/logo.png'), asset('icons/menu #1.svg')] };
const state: DeploymentState = { version: 1, target, assets: manifest.assets.map(asset => ({ asset,
  key: `mvp/${asset.storageKey}`, cacheControl: 'max-age=0', status: 'verified', verifiedAt: '2026-10-12T00:00:00Z' })) };
const options = { manifest, state, target, publicBaseUrl: 'https://cdn.example.com/mvp/' };

describe('delivery resolver', () => {
  it('preserves suffixes, encodes filenames and includes the namespace once', () => {
    const resolver = createAssetUrlResolver(options);
    expect(resolver.resolve('/images/logo.png?v=2#crop')).toBe('https://cdn.example.com/mvp/images/logo.png?v=2#crop');
    expect(resolver.resolve('/icons/menu%20%231.svg')).toBe('https://cdn.example.com/mvp/icons/menu%20%231.svg');
  });
  it('handles an application base path and leaves routes and nonlocal URLs untouched', () => {
    const resolver = createAssetUrlResolver({ ...options, basePath: '/app/' });
    expect(resolver.resolve('/app/images/logo.png')).toBe('https://cdn.example.com/mvp/images/logo.png');
    for (const url of ['/account', '/excluded.png', '//example.com/a', 'https://example.com/a',
      'data:image/png;base64,abc', '#logo', '../images/logo.png', '/images%2flogo.png', '/%2e%2e/images/logo.png']) {
      expect(resolver.resolve(url)).toBe(url);
    }
  });
  it('requires matching verified state only for managed references', () => {
    const missing = createAssetUrlResolver({ ...options, state: undefined });
    expect(missing.resolve('/route')).toBe('/route');
    expect(() => missing.resolve('/images/logo.png')).toThrow('Run simpcn migrate');
    for (const change of [{ status: 'uploaded' as const }, { asset: { ...state.assets[0].asset, hash: '0'.repeat(64) } }, { key: 'wrong' }]) {
      const stale = createAssetUrlResolver({ ...options, state: { ...state, assets: [{ ...state.assets[0], ...change }] } });
      expect(() => stale.resolve('/images/logo.png')).toThrow('missing or stale');
    }
    expect(() => createAssetUrlResolver({ ...options, target: { ...target, prefix: 'other' } })).toThrow('different storage target');
  });
  it('builds browser-safe maps and rejects exporting unverified managed assets', () => {
    const map = createAssetUrlResolver(options).deliveryMap();
    expect(createUrlMapper({ urls: map })('/images/logo.png?x=1')).toBe('https://cdn.example.com/mvp/images/logo.png?x=1');
    expect(createUrlMapper({ urls: map })('/route')).toBe('/route');
    expect(JSON.stringify(map)).not.toContain('verifiedAt');
    expect(() => createAssetUrlResolver({ ...options, state: { ...state, assets: [] } }).deliveryMap()).toThrow();
  });
  it('parses srcset without splitting data URL commas', () => {
    const resolve = createAssetUrlResolver(options).resolve;
    expect(resolveSrcSet('data:image/png;base64,abc 1x, /images/logo.png 2x', resolve)).toBe('data:image/png;base64,abc 1x, https://cdn.example.com/mvp/images/logo.png 2x');
    expect(resolveSrcSet('/images/logo.png, /images/logo.png 2x', resolve)).toBe('https://cdn.example.com/mvp/images/logo.png, https://cdn.example.com/mvp/images/logo.png 2x');
  });
  it('validates public URL configuration and flags override config', () => {
    expect(normalizePublicBaseUrl('https://cdn.example.com/mvp')).toBe('https://cdn.example.com/mvp/');
    for (const url of ['file:///tmp', 'https://user:secret@cdn.example.com/', 'https://cdn.example.com/?secret=x', 'https://cdn.example.com/#x']) {
      expect(() => normalizePublicBaseUrl(url)).toThrow();
    }
    const config = resolveConfig({ storage: { bucket: 'test' }, publicBaseUrl: 'https://old.example.com/' },
      { 'public-base-url': 'https://new.example.com/mvp' }, '/tmp/project', '/tmp/project');
    expect(config.publicBaseUrl).toBe('https://new.example.com/mvp/');
  });
});
