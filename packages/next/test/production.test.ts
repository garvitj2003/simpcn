import { it, expect } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
import { generateManifest } from '@simpcn/core';

const exec = promisify(execFile);
const require = createRequire(import.meta.url);
const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const repo = path.resolve(packageRoot, '../..');
const nextBin = require.resolve('next/dist/bin/next');
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

for (const bundler of ['turbopack', 'webpack']) it(`unchanged JSX emits direct CDN URL in a real ${bundler} production build`, async () => {
  const cdnRequests: string[] = [];
  const bytes = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="20" height="20" fill="red"/></svg>';
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
  const cdn = createServer((request, response) => {
    cdnRequests.push(request.url!);
    response.writeHead(request.url?.startsWith('/assets/images/') ? 200 : 404, { 'content-type': request.url?.includes('.png') ? 'image/png' : 'image/svg+xml' });
    response.end(request.url?.includes('.png') ? png : bytes);
  });
  await new Promise<void>((resolve, reject) => { cdn.once('error', reject); cdn.listen(0, '127.0.0.1', resolve); });
  const cdnBase = `http://127.0.0.1:${(cdn.address() as AddressInfo).port}/assets/`;
  await mkdir(path.join(repo, '.simpcn'), { recursive: true });
  const root = await mkdtemp(path.join(repo, '.simpcn/next-proof-'));
  let child: ReturnType<typeof spawn> | undefined;
  try {
    await mkdir(path.join(root, 'app'));
    await mkdir(path.join(root, 'app/ssr'));
    await mkdir(path.join(root, 'pages'));
    await mkdir(path.join(root, 'public/images'), { recursive: true });
    await mkdir(path.join(root, 'node_modules'));
    await mkdir(path.join(root, 'node_modules/@simpcn'));
    await symlink(packageRoot, path.join(root, 'node_modules/@simpcn/next'));
    for (const dependency of ['next', 'react', 'react-dom']) await symlink(path.join(packageRoot, 'node_modules', dependency), path.join(root, 'node_modules', dependency));
    await writeFile(path.join(root, 'package.json'), JSON.stringify({ name: 'next-proof', private: true, dependencies: { next: '16.4.0', react: '19.3.0', 'react-dom': '19.3.0' } }));
    await writeFile(path.join(root, 'app/layout.jsx'), 'export default function Layout({children}) { return <html><body>{children}</body></html> }');
    const source = 'import Client from "./client";import Image from "next/image";export default function Page() { return <><img id="proof" src="/images/logo.svg" alt="Proof" /><Image id="managed" src="/images/logo.png" width={1} height={1} alt="Managed"/><Image id="unmanaged" src="/local-only.png" width={1} height={1} alt="Unmanaged"/><Client/></> }';
    await writeFile(path.join(root, 'app/page.jsx'), source);
    await writeFile(path.join(root, 'app/client.jsx'), `'use client';import {useState} from 'react';import {assetUrl} from '@simpcn/next/assets';export default function Client(){const [name,setName]=useState('logo');return <><img id="client" src={assetUrl('/images/'+name+'.svg')} alt="Client"/><button onClick={()=>setName('logo')}>Update</button></>}`);
    await writeFile(path.join(root, 'app/ssr/page.jsx'), `import {assetUrl} from '@simpcn/next/assets'; export const dynamic='force-dynamic'; export default function Page(){return <img id="ssr" src={assetUrl('/docs/images/menu%20%23%25.svg?v=1#shape')} alt="SSR"/>}`);
    await writeFile(path.join(root, 'pages/isr.jsx'), `import {assetUrl} from '@simpcn/next/assets'; export function getStaticProps(){return {props:{stamp:Date.now()},revalidate:1}}; export default function Page({stamp}){return <img data-stamp={stamp} src={assetUrl('/images/logo.svg')} alt="ISR"/>}`);
    await writeFile(path.join(root, 'public/images/logo.svg'), bytes);
    await writeFile(path.join(root, 'public/images/logo.png'), png);
    await writeFile(path.join(root, 'public/local-only.png'), png);
    await writeFile(path.join(root, 'public/images/menu #%.svg'), bytes);
    await writeFile(path.join(root, 'next.config.ts'), `import type {NextConfig} from 'next'; import {withSimpcn} from '@simpcn/next'; const config:NextConfig={basePath:'/docs',turbopack:{root:${JSON.stringify(repo)}},experimental:{cpus:1}}; export default withSimpcn(config, {cwd:${JSON.stringify(root)}});`);
    await writeFile(path.join(root, 'simpcn.config.ts'), `export default {exclude:['local-only.png'],storage:{bucket:'test',prefix:'assets'},publicBaseUrl:${JSON.stringify(cdnBase)}};`);
    const manifest = await generateManifest({ root: path.join(root, 'public'), exclude: ['local-only.png'] });
    await mkdir(path.join(root, '.simpcn'));
    await writeFile(path.join(root, '.simpcn/deployment-state.json'), JSON.stringify({ version: 1, target: { service: 'aws-s3:us-east-1', bucket: 'test', prefix: 'assets' }, assets: manifest.assets.map(asset => ({ asset, key: 'assets/' + asset.storageKey, status: 'verified', verifiedAt: 'fixture', cacheControl: 'public, max-age=0, must-revalidate' })) }));
    await exec(process.execPath, [nextBin, 'build', `--${bundler}`], { cwd: root, env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' }, timeout: 120000, maxBuffer: 2 * 1024 * 1024 }).catch(error => { throw new Error(`${error.stdout}\n${error.stderr}`); });
    expect(await readFile(path.join(root, 'app/page.jsx'), 'utf8')).toBe(source);
    expect(await readFile(path.join(root, 'public/images/logo.svg'), 'utf8')).toBe(bytes);
    const html = await readFile(path.join(root, '.next/server/app/index.html'), 'utf8');
    expect(html).toContain(`src="${cdnBase}images/logo.svg"`);
    expect(html).not.toContain('src="/images/logo.svg"');
    const managed = html.match(/<img\b[^>]*\bid="managed"[^>]*>/)?.[0];
    expect(managed).toContain(`src="${cdnBase}images/logo.png"`);
    expect(managed).not.toContain('/_next/image');
    expect(managed).not.toContain('srcSet=');
    const unmanaged = html.match(/<img\b[^>]*\bid="unmanaged"[^>]*>/)?.[0];
    expect(unmanaged).toContain('/_next/image?');
    expect(html).toMatch(new RegExp(`id="client"[^>]+src="${cdnBase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}images/logo\\.svg"`));
    // Model deployment without the build machine's manifests or original public files.
    await rm(path.join(root, '.simpcn'), { recursive: true, force: true });
    await rm(path.join(root, 'public'), { recursive: true, force: true });
    // Serve the actual built application, then follow its emitted src to the independent asset origin.
    const portProbe = createServer();
    await new Promise<void>((resolve, reject) => { portProbe.once('error', reject); portProbe.listen(0, '127.0.0.1', resolve); });
    const port = (portProbe.address() as AddressInfo).port;
    await new Promise<void>(resolve => portProbe.close(() => resolve()));
    child = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', String(port)], { cwd: root, env: { ...process.env, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' }, stdio: 'ignore' });
    let response: Response | undefined;
    for (let attempt = 0; attempt < 100; attempt++) {
      response = await fetch(`http://127.0.0.1:${port}/docs`).catch(() => undefined);
      if (response?.ok) break;
      await delay(100);
    }
    expect(response?.status).toBe(200);
    expect(await response!.text()).toContain(`src="${cdnBase}images/logo.svg"`);
    const ssr = await fetch(`http://127.0.0.1:${port}/docs/ssr`);
    expect(ssr.status).toBe(200);
    expect(await ssr.text()).toContain(`src="${cdnBase}images/menu%20%23%25.svg?v=1#shape"`);
    const firstIsr = await (await fetch(`http://127.0.0.1:${port}/docs/isr`)).text();
    expect(firstIsr).toContain(`src="${cdnBase}images/logo.svg"`);
    const stamp = firstIsr.match(/data-stamp="(\d+)"/)?.[1];
    expect(stamp).toBeDefined();
    await delay(1200);
    let regenerated = '';
    for (let attempt = 0; attempt < 40; attempt++) {
      regenerated = await (await fetch(`http://127.0.0.1:${port}/docs/isr`)).text();
      if (regenerated.match(/data-stamp="(\d+)"/)?.[1] !== stamp) break;
      await delay(100);
    }
    expect(regenerated.match(/data-stamp="(\d+)"/)?.[1]).not.toBe(stamp);
    expect(regenerated).toContain(`src="${cdnBase}images/logo.svg"`);
    const asset = await fetch(`${cdnBase}images/logo.svg`);
    expect(asset.status).toBe(200);
    expect(await asset.text()).toBe(bytes);
    expect(cdnRequests).toContain('/assets/images/logo.svg');
    const managedAsset = await fetch(`${cdnBase}images/logo.png`);
    expect(managedAsset.status).toBe(200);
    expect(Buffer.from(await managedAsset.arrayBuffer())).toEqual(png);
  } finally {
    if (child && child.exitCode === null) { child.kill('SIGTERM'); await new Promise<void>(resolve => child!.once('exit', () => resolve())); }
    await new Promise<void>(resolve => cdn.close(() => resolve()));
    await rm(root, { recursive: true, force: true });
  }
}, 150000);
