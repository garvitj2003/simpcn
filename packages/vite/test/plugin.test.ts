import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, readdir, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { runInNewContext } from 'node:vm';
import { pathToFileURL } from 'node:url';
import { build, resolveConfig as resolveViteConfig } from 'vite';
import { generateManifest, createAssetUrlResolver, type DeploymentState } from '@simpcn/core';
import { simpcn as workspaceSimpcn } from '../src/index.js';
import { transformJs, transformHtml, transformCss } from '../src/transforms.js';

const { simpcn } = process.env.SIMPCN_PACKED_CONSUMER
  ? await import(pathToFileURL(path.join(process.env.SIMPCN_PACKED_CONSUMER, 'node_modules/@simpcn/vite/dist/index.js')).href) as { simpcn: typeof workspaceSimpcn }
  : { simpcn: workspaceSimpcn };

let root: string;
let state: DeploymentState;
beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'simpcn-vite-'));
  await mkdir(path.join(root, 'public', 'images'), { recursive: true });
  await writeFile(path.join(root, 'public', 'images', 'logo.png'), 'image bytes');
  await writeFile(path.join(root, 'public', 'images', 'menu #1.svg'), '<svg/>');
  await writeFile(path.join(root, 'public', 'images', 'menu ?%.svg'), '<svg/>');
  await writeFile(path.join(root, 'public', 'font.woff2'), 'font bytes');
  await writeFile(path.join(root, 'public', 'excluded.png'), 'excluded');
  await writeFile(path.join(root, 'simpcn.config.ts'), 'export default ' + JSON.stringify({ version: 1, storage: { bucket: 'test', prefix: 'mvp' },
    exclude: ['excluded.png'], publicBaseUrl: 'https://cdn.example.com/mvp/', stateFile: '.simpcn/state.json' }));
  const manifest = await generateManifest({ root: path.join(root, 'public'), exclude: ['excluded.png'] });
  state = { version: 1, target: { service: 'aws-s3:us-east-1', bucket: 'test', prefix: 'mvp' },
    assets: manifest.assets.map(asset => ({ asset, key: 'mvp/' + asset.storageKey, status: 'verified', verifiedAt: 'now',
      cacheControl: 'public, max-age=0, must-revalidate' })) };
  await mkdir(path.join(root, '.simpcn'));
  await writeFile(path.join(root, '.simpcn', 'state.json'), JSON.stringify(state));
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });
const resolver = () => createAssetUrlResolver({ manifest: { version: 1, assets: state.assets.map(a => a.asset) }, state,
  target: state.target, publicBaseUrl: 'https://cdn.example.com/mvp/' });
const runBuild = (extra = {}) => build({ root, configFile: false, logLevel: 'silent', plugins: [simpcn()],
  oxc: { jsx: { runtime: 'classic', pragma: 'React.createElement', pragmaFrag: 'React.Fragment' } },
  build: { minify: false, sourcemap: true }, ...extra });

describe('parser transforms', () => {
  it('rewrites JSX literals/srcSet, preserves routes/comments, and reports dynamic props', () => {
    const warnings: string[] = [];
    const source = `// /images/logo.png\nconst route = '/images/logo.png';\nconst jsx = <><img src="/images/logo.png" srcSet={'/images/logo.png 1x, /images/logo.png 2x'} /><video poster={\`/images/logo.png\`} /><img src={dynamic} /><a href="/images/logo.png">route</a></>;`;
    const result = transformJs(source, 'component.tsx', resolver(), message => warnings.push(message))!;
    expect(result.code).toContain('src={"https://cdn.example.com/mvp/images/logo.png"}');
    expect(result.code).toContain('const route = \'/images/logo.png\'');
    expect(result.code).toContain('<a href="/images/logo.png">');
    expect(result.code).toContain('// /images/logo.png');
    expect(warnings).toHaveLength(1);
    expect(result.map.sourcesContent).toEqual([source]);
  });
  it('rewrites HTML, inline styles, CSS and escaped URLs without modifying comments', () => {
    const html = transformHtml(`<img src='/images/logo.png?x=1&amp;y=2'><a href='/images/logo.png'>route</a><style>body{background:url('/images/logo.png')}</style>`, resolver());
    expect(html).toContain('https://cdn.example.com/mvp/images/logo.png?x=1&amp;y=2');
    expect(html).toContain("<a href='/images/logo.png'>");
    const css = transformCss(`/* url('/images/logo.png') */ @font-face{src:url('/font.woff2')} body{background:url(/images/lo\\67 o.png)}`, 'style.css', resolver())!;
    expect(css.code).toContain('https://cdn.example.com/mvp/font.woff2');
    expect(css.code).toContain('https://cdn.example.com/mvp/images/logo.png');
    expect(css.code).toContain("/* url('/images/logo.png') */");
  });
});

describe('Vite production builds', () => {
  it('builds HTML, TSX and CSS with CDN URLs and preserves local originals and exclusions', async () => {
    const html = `<link rel="stylesheet" href="/style.css"><img src="/images/logo.png"><img src="/excluded.png"><a href="/account">route</a><script type="module" src="/main.tsx"></script>`;
    const source = `import './style.css'; const React={createElement:(...args)=>args}; document.body.dataset.jsx = JSON.stringify(<img src="/images/logo.png" />);`;
    await writeFile(path.join(root, 'index.html'), html);
    await writeFile(path.join(root, 'main.tsx'), source);
    await writeFile(path.join(root, 'style.css'), `@font-face{font-family:test;src:url('/font.woff2')} body{background:url('/images/logo.png')}`);
    await runBuild();
    expect(await readFile(path.join(root, 'index.html'), 'utf8')).toBe(html);
    expect(await readFile(path.join(root, 'main.tsx'), 'utf8')).toBe(source);
    const output = await readFile(path.join(root, 'dist', 'index.html'), 'utf8');
    expect(output).toContain('https://cdn.example.com/mvp/images/logo.png');
    expect(output).toContain('/excluded.png');
    expect(output).toContain('/account');
    const files = await readdir(path.join(root, 'dist', 'assets'));
    const js = await readFile(path.join(root, 'dist', 'assets', files.find(f => f.endsWith('.js'))!), 'utf8');
    const css = await readFile(path.join(root, 'dist', 'assets', files.find(f => f.endsWith('.css'))!), 'utf8');
    expect(js).toContain('https://cdn.example.com/mvp/images/logo.png');
    expect(css).toContain('https://cdn.example.com/mvp/font.woff2');
  });
  it('supports native public imports, base paths and a runtime helper without bundling SDK/state', async () => {
    await writeFile(path.join(root, 'index.html'), '<script type="module" src="/main.js"></script>');
    await writeFile(path.join(root, 'main.js'), `import logo from '/images/logo.png?url'; import menu from '/images/menu%20%231.svg?url&v=one%20two#shape'; import special from '/images/menu%20%3F%25.svg?url'; import { assetUrl } from 'virtual:simpcn'; document.body.dataset.logo=logo; document.body.dataset.menu=menu; document.body.dataset.special=special; document.body.dataset.dynamic=assetUrl('/app/images/logo.png?x=1');`);
    await runBuild({ base: '/app/' });
    const files = await readdir(path.join(root, 'dist', 'assets'));
    const code = await readFile(path.join(root, 'dist', 'assets', files.find(f => f.endsWith('.js'))!), 'utf8');
    expect(code).toContain('https://cdn.example.com/mvp/images/logo.png');
    expect(code).not.toContain('aws-sdk');
    expect(code).not.toContain('verifiedAt');
    expect(code).not.toContain('aws-s3:us-east-1');
    const document = { body: { dataset: {} as Record<string, string> }, createElement: () => ({ relList: { supports: () => true } }) };
    runInNewContext(code, { document });
    expect(document.body.dataset.logo).toBe('https://cdn.example.com/mvp/images/logo.png');
    expect(document.body.dataset.menu).toBe('https://cdn.example.com/mvp/images/menu%20%231.svg?v=one%20two#shape');
    expect(document.body.dataset.special).toBe('https://cdn.example.com/mvp/images/menu%20%3F%25.svg');
    expect(document.body.dataset.dynamic).toBe('https://cdn.example.com/mvp/images/logo.png?x=1');
  });
  it('fails referenced stale/missing assets and requires public delivery configuration', async () => {
    await writeFile(path.join(root, 'index.html'), '<img src="/images/logo.png">');
    await writeFile(path.join(root, 'public', 'images', 'logo.png'), 'changed bytes');
    await expect(runBuild()).rejects.toThrow('missing or stale');
    await rm(path.join(root, '.simpcn', 'state.json'));
    await expect(runBuild()).rejects.toThrow('missing or stale');
    await writeFile(path.join(root, 'simpcn.config.ts'), 'export default ' + JSON.stringify({ storage: { bucket: 'test' } }));
    await expect(runBuild()).rejects.toThrow('publicBaseUrl');
  });
  it('keeps development local without requiring config or deployment state', async () => {
    await rm(path.join(root, 'simpcn.config.ts'));
    await rm(path.join(root, '.simpcn'), { recursive: true });
    const plugin = simpcn();
    const config = await resolveViteConfig({ root, configFile: false, base: '/app/', plugins: [plugin] }, 'serve');
    const transform = plugin.transform as Function;
    expect(transform.call({}, '<img src="/images/logo.png" />', 'component.tsx')).toBeUndefined();
    const load = plugin.load as Function;
    expect(load.call({}, '\0virtual:simpcn')).toBe('export const assetUrl = value => value;');
    const resolve = plugin.resolveId as Function;
    const context = { addWatchFile: vi.fn() };
    const id = await resolve.call(context, '/images/menu%20%231.svg?url&v=one%20two#shape');
    expect(load.call({}, id)).toBe('export default "/app/images/menu%20%231.svg?v=one%20two#shape";');
    expect(context.addWatchFile).toHaveBeenCalledWith(await realpath(path.join(root, 'public', 'images', 'menu #1.svg')));
    expect(await resolve.call(context, '/account?url')).toBeUndefined();
    expect(await resolve.call(context, '/images/logo.png?raw')).toBeUndefined();
    expect(config.command).toBe('serve');
    expect(await readdir(root)).toContain('public');
  });
  it('requires verified deployment state for encoded URL imports', async () => {
    await writeFile(path.join(root, 'index.html'), '<script type="module" src="/main.js"></script>');
    await writeFile(path.join(root, 'main.js'), `import menu from '/images/menu%20%231.svg?url'; document.body.dataset.menu=menu;`);
    state.assets = state.assets.filter(record => record.asset.relativePath !== 'images/menu #1.svg');
    await writeFile(path.join(root, '.simpcn', 'state.json'), JSON.stringify(state));
    await expect(runBuild()).rejects.toThrow('missing or stale');
  });
});
