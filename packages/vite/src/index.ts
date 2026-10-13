import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lstat, realpath } from 'node:fs/promises';
import { findConfig, loadConfig, loadAssetUrlResolver, resolveStorageTarget, type AssetUrlResolver, type Config } from '@simpcn/core';
import type { Plugin, ResolvedConfig } from 'vite';
import { transformJs, transformCss, transformHtml } from './transforms.js';
import { parsePublicUrlImport } from './public-import.js';

export interface SimpcnViteOptions { config?: string }
const virtualId = 'virtual:simpcn';
const resolvedVirtualId = '\0' + virtualId;
const publicUrlId = '\0simpcn:public-url:';
const browserRuntime = fileURLToPath(import.meta.resolve('@simpcn/core/delivery')).split(path.sep).join('/');

export function simpcn(options: SimpcnViteOptions = {}): Plugin {
  let vite: ResolvedConfig;
  let project: Config;
  let resolver: AssetUrlResolver | undefined;
  let basePath = '/';
  const warned = new Set<string>();
  async function loadProject(): Promise<void> {
    project = await loadConfig({ config: options.config }, vite.root);
    if (!project.publicBaseUrl) throw new Error('simpcn: publicBaseUrl is required for production builds. Set it in simpcn.config.ts to the public URL of your uploaded assets.');
    if (!vite.publicDir || await realpath(vite.publicDir) !== await realpath(project.root)) {
      throw new Error('simpcn: the configured asset root must match Vite publicDir');
    }
  }
  return {
    name: 'vite-plugin-simpcn', enforce: 'pre',
    config(user, environment) {
      if (environment.command !== 'build') return;
      const previous = user.experimental?.renderBuiltUrl;
      return { experimental: {
        renderBuiltUrl(filename, context) {
          if (context.type === 'public') {
            const original = '/' + filename.replace(/^\/+/, '');
            const resolved = resolver?.resolve(original);
            if (resolved && resolved !== original) return resolved;
          }
          return previous?.(filename, context);
        },
      } };
    },
    async configResolved(config) {
      vite = config;
      basePath = vite.base.startsWith('/') ? vite.base : /^https?:/.test(vite.base) ? new URL(vite.base).pathname : '/';
      if (vite.command !== 'build') return;
      await loadProject();
    },
    async buildStart() {
      if (vite.command !== 'build') return;
      await loadProject();
      resolver = await loadAssetUrlResolver({ ...project, publicBaseUrl: project.publicBaseUrl!,
        target: resolveStorageTarget(project.storage), basePath });
      warned.clear();
      this.addWatchFile(project.stateFile);
      this.addWatchFile(project.root);
      for (const asset of resolver.managedPaths) this.addWatchFile(path.join(project.root, ...asset.split('/')));
      const configPath = options.config ? path.resolve(vite.root, options.config) : await findConfig(vite.root);
      if (configPath) this.addWatchFile(configPath);
    },
    async resolveId(id) {
      if (id === virtualId) return resolvedVirtualId;
      const reference = parsePublicUrlImport(id, basePath);
      if (!reference) return;
      let url: string | undefined;
      if (vite.command === 'build') url = resolver?.resolveKey(reference.key);
      else if (vite.publicDir) {
        // Development requires no storage config. Only intercept regular local public files.
        const root = await realpath(vite.publicDir).catch((error: NodeJS.ErrnoException) => {
          if (error.code === 'ENOENT') return undefined;
          throw error;
        });
        if (!root) return;
        const filename = path.join(root, ...reference.key.split('/'));
        try {
          if (!(await lstat(filename)).isFile() || await realpath(filename) !== filename) return;
        } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return; throw error; }
        this.addWatchFile(filename);
        url = (basePath.endsWith('/') ? basePath : basePath + '/') + reference.key.split('/').map(encodeURIComponent).join('/');
      }
      if (url) return publicUrlId + encodeURIComponent(url + reference.suffix);
    },
    load(id) {
      if (id.startsWith(publicUrlId)) return `export default ${JSON.stringify(decodeURIComponent(id.slice(publicUrlId.length)))};`;
      if (id !== resolvedVirtualId) return;
      if (vite.command !== 'build') return 'export const assetUrl = value => value;';
      const urls = JSON.stringify(JSON.stringify(resolver!.deliveryMap()));
      return `import { createUrlMapper } from ${JSON.stringify(browserRuntime)};\nexport const assetUrl = createUrlMapper({ urls: JSON.parse(${urls}), basePath: ${JSON.stringify(basePath)} });`;
    },
    transform(code, id) {
      if (vite.command !== 'build' || !resolver || id.startsWith('\0') || id.includes('/node_modules/')) return;
      const filename = id.split('?')[0];
      if (/\.css$/.test(filename) && !id.includes('?raw') && !id.includes('?url')) return transformCss(code, filename, resolver);
      if (/\.[cm]?[jt]sx?$/.test(filename) && !id.includes('?raw') && !id.includes('?url')) {
        return transformJs(code, filename, resolver, message => { if (!warned.has(message)) { warned.add(message); this.warn(message); } });
      }
    },
    transformIndexHtml: { order: 'pre', handler(html) { return vite.command === 'build' && resolver ? transformHtml(html, resolver) : html; } },
  };
}
export default simpcn;
