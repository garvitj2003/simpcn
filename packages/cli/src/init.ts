import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import inputPrompt from '@inquirer/input';
import selectPrompt from '@inquirer/select';
import pc from 'picocolors';
import { initializeConfig } from './config.js';
import type { Flags } from './args.js';
import { version } from './version.js';

export interface InitOptions {
  interactive?: boolean;
  signal?: AbortSignal;
  select?: (question: string, choices: { name: string; value: string }[], fallback: string) => Promise<string>;
  ask?: (question: string, fallback: string) => Promise<string>;
  install?: (manager: string, args: string[], cwd: string) => Promise<void>;
}
async function exists(filename: string): Promise<boolean> {
  try { await readFile(filename); return true; } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
}
export async function initializeProject(input: Flags, cwd: string, options: InitOptions = {}) {
  const flags = { ...input };
  let pkg: { name?: string; packageManager?: string; dependencies?: Record<string,string>; devDependencies?: Record<string,string> } = {};
  try { pkg = JSON.parse(await readFile(path.join(cwd, 'package.json'), 'utf8')); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
  const detected = dependencies.next ? 'next' : dependencies.vite ? 'vite' : 'core';
  const interactive = options.interactive && !flags.yes && !flags.json;
  const promptContext = { output: process.stderr, signal: options.signal };
  const ask = options.ask ?? ((message: string, fallback: string) => inputPrompt({ message, default: fallback }, promptContext));
  const select = options.select ?? ((message: string, choices: { name: string; value: string }[], fallback: string) =>
    selectPrompt({ message, choices, default: fallback }, promptContext));
  if (interactive && !options.ask && !options.select) process.stderr.write(`\n${pc.bold(pc.cyan('simpcn'))} ${pc.dim('— project setup')}\n\n`);
  flags.framework ??= interactive ? await select('Select your framework', [
    { name: 'Vite (React, Vue, Svelte)', value: 'vite' },
    { name: 'Next.js (Turbopack / webpack)', value: 'next' },
    { name: 'Core only — asset migration without a framework plugin', value: 'core' },
  ], detected) : detected;
  if (!['vite', 'next', 'core'].includes(flags.framework)) throw new Error('Choose framework vite, next or core');
  if (interactive) {
    flags.provider ??= await select('Select your storage provider', [
      { name: 'AWS S3', value: 's3' },
      { name: 'MinIO', value: 'minio' },
      { name: 'Cloudflare R2', value: 'r2' },
    ], 's3');
    flags.region ??= flags.provider === 'r2' ? 'auto' : await ask('Storage region', 'us-east-1');
    if (flags.bucket === undefined) {
      const bucket = await ask('Existing bucket (leave blank to use project name)', '');
      if (bucket) flags.bucket = bucket;
    }
    flags.prefix ??= await ask('Storage prefix', 'assets');
  }
  options.signal?.throwIfAborted();
  const config = await initializeConfig(flags, cwd);
  const warnings: string[] = [];
  if (flags.provider !== 's3' && flags.provider && !flags.endpoint) warnings.push('Set storage.endpoint in simpcn.config.ts before planning or migrating.');
  if (!flags['public-base-url']) warnings.push('Set publicBaseUrl in simpcn.config.ts before building with the framework plugin.');
  warnings.push('The bucket must already exist; init does not create buckets or change public access.');
  const directory = path.dirname(config);
  const template = path.join(directory, '.env.example');
  if (!await exists(template)) await writeFile(template, 'AWS_ACCESS_KEY_ID=\nAWS_SECRET_ACCESS_KEY=\n# AWS_SESSION_TOKEN=\n', { flag: 'wx' });
  const ignorePath = path.join(directory, '.gitignore');
  const ignore = await exists(ignorePath) ? await readFile(ignorePath, 'utf8') : '';
  const missing = ['.env', '.env.local', '.simpcn/'].filter(line => !ignore.split(/\r?\n/).includes(line));
  if (missing.length) await writeFile(ignorePath, ignore + (ignore.endsWith('\n') || !ignore ? '' : '\n') + missing.join('\n') + '\n');
  if (flags.framework === 'vite' || flags.framework === 'next') {
    const packageName = flags.framework === 'next' ? '@simpcn/next' : '@simpcn/vite';
    const manager = pkg.packageManager?.split('@')[0] ?? (await exists(path.join(cwd, 'pnpm-lock.yaml')) ? 'pnpm' : await exists(path.join(cwd, 'yarn.lock')) ? 'yarn' : await exists(path.join(cwd, 'bun.lock')) ? 'bun' : 'npm');
    if (!['npm', 'pnpm', 'yarn', 'bun'].includes(manager)) throw new Error(`Unsupported package manager: ${manager}`);
    if ((!dependencies[packageName]) && !flags['skip-install']) {
      const integration = flags['integration-package'] ? path.resolve(cwd, flags['integration-package']) : `${packageName}@${version}`;
      if (flags['integration-package'] && (!integration.endsWith('.tgz') || !await exists(integration))) throw new Error('integration-package must point to an existing .tgz archive');
      const packages = [integration];
      const args = manager === 'npm' ? ['install', '-D', ...packages] : ['add', '-D', ...packages];
      const install = options.install ?? ((manager: string, args: string[], cwd: string) => new Promise<void>((resolve, reject) => {
        const child = spawn(manager, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: false });
        child.stdout?.pipe(process.stderr); child.stderr?.pipe(process.stderr);
        child.on('error', reject); child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${manager} installation failed (${code})`)));
      }));
      try { await install(manager, args, cwd); }
      catch (error) { throw new Error(`Config created at ${config}, but integration installation failed. Install ${packageName} manually and configure your framework integration; the generated storage config has been kept. ${String(error)}`); }
    } else if (!dependencies[packageName]) warnings.push(`Install ${packageName} before building.`);
    if (flags.framework === 'next') {
      warnings.push('In next.config.ts or next.config.mjs, add import { withSimpcn } from "@simpcn/next"; then wrap your existing config: export default withSimpcn(nextConfig);');
      warnings.push('Next.js adapter prototype: regular JSX media references, verified static next/image and assetUrl() are supported; CSS rewriting is not implemented.');
    } else warnings.push('Add import { simpcn } from "@simpcn/vite" to your Vite config, then put simpcn() first in its plugins array.');
  }
  return { config, framework: flags.framework, warnings };
}
