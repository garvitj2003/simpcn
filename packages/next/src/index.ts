import path from 'node:path';
import { realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import { loadConfig, loadAssetUrlResolver, resolveStorageTarget } from '@simpcn/core';
import { generateRuntime } from './runtime.js';

type Configuration = NextConfig | ((phase: string, context: { defaultConfig: NextConfig }) => NextConfig | Promise<NextConfig>);
export interface SimpcnNextOptions { cwd?: string; config?: string }

/** Config preparation only. Source rewriting is performed by the actual bundler loader below. */
export function withSimpcn(configuration: Configuration = {}, options: SimpcnNextOptions = {}) {
  return async (phase: string, context: { defaultConfig: NextConfig }): Promise<NextConfig> => {
    const original = typeof configuration === 'function' ? await configuration(phase, context) : configuration;
    if (phase !== 'phase-production-build') return original;
    const cwd = path.resolve(options.cwd ?? process.cwd());
    const project = await loadConfig({ config: options.config }, cwd);
    if (!project.publicBaseUrl) throw new Error('simpcn: publicBaseUrl is required for production builds. Set it in simpcn.config.ts.');
    if (await realpath(project.root) !== await realpath(path.join(cwd, 'public'))) throw new Error('simpcn: configured asset root must match Next.js public/');
    const basePath = original.basePath ?? '/';
    const resolver = await loadAssetUrlResolver({ ...project, publicBaseUrl: project.publicBaseUrl, target: resolveStorageTarget(project.storage), basePath });
    // Turbopack requires ordinary JSON objects (the core map has a null prototype).
    const urls = { ...resolver.deliveryMap() };
    const loader = fileURLToPath(new URL('./loader.cjs', import.meta.url));
    const loaderOptions = {
      urls, basePath, nextImages: true,
      preserveImageOptimization: original.images?.unoptimized === false || original.images?.loader === 'custom' || !!original.images?.loaderFile,
    };
    const runtime = await generateRuntime(cwd, loaderOptions);
    const rules = { ...original.turbopack?.rules };
    for (const extension of ['js', 'jsx', 'ts', 'tsx', 'mjs', 'mts']) {
      const key = `*.${extension}`;
      const existing = rules[key];
      rules[key] = [...(existing ? Array.isArray(existing) ? existing : [existing] : []), {
        condition: { not: 'foreign' }, loaders: [{ loader, options: loaderOptions }],
      }];
    }
    const previous = original.webpack;
    return {
      ...original,
      // Turbopack treats /absolute/path as a server-relative URL; use an app-relative alias.
      turbopack: { ...original.turbopack, rules, resolveAlias: { ...original.turbopack?.resolveAlias, '@simpcn/next/assets': './' + path.relative(cwd, runtime).split(path.sep).join('/') } },
      webpack(config, webpackContext) {
        const updated = previous ? previous(config, webpackContext) : config;
        if (updated && typeof updated.then === 'function') throw new Error('simpcn: Next.js webpack callbacks must return configuration synchronously; async next.config functions are supported.');
        updated.module ??= {};
        updated.resolve ??= {};
        updated.resolve.alias = { ...updated.resolve.alias, '@simpcn/next/assets$': runtime };
        updated.module.rules ??= [];
        updated.module.rules.unshift({ test: /\.[cm]?[jt]sx?$/, exclude: /node_modules/, enforce: 'pre', use: [{ loader, options: loaderOptions }] });
        return updated;
      },
    };
  };
}
