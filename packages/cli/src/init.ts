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
  const detected = dependencies.expo ? 'expo' : dependencies.next ? 'next' : dependencies.vite ? 'vite' : 'core';
  const interactive = options.interactive && !flags.yes && !flags.json;
  const promptContext = { output: process.stderr, signal: options.signal };
  const ask = options.ask ?? ((message: string, fallback: string) => inputPrompt({ message, default: fallback }, promptContext));
  const select = options.select ?? ((message: string, choices: { name: string; value: string }[], fallback: string) =>
    selectPrompt({ message, choices, default: fallback }, promptContext));
  if (interactive && !options.ask && !options.select) process.stderr.write(`\n${pc.bold(pc.cyan('simpcn'))} ${pc.dim('— project setup')}\n\n`);
  flags.framework ??= interactive ? await select('Select your framework', [
    { name: 'Expo (iOS / Android, experimental)', value: 'expo' },
    { name: 'Vite (React, Vue, Svelte)', value: 'vite' },
    { name: 'Next.js (Turbopack / webpack)', value: 'next' },
    { name: 'Core only — asset migration without a framework plugin', value: 'core' },
  ], detected) : detected;
  if (!['vite', 'next', 'expo', 'core'].includes(flags.framework)) throw new Error('Choose framework vite, next, expo or core');
  const isExpo = flags.framework === 'expo';
  if (isExpo) flags.root ??= 'assets/cdn';
  const defaultPrefix = isExpo ? 'releases/v1' : 'assets';
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
    flags.prefix ??= await ask(isExpo ? 'Immutable release prefix (use a unique value for each release)' : 'Storage prefix', defaultPrefix);
  }
  flags.prefix ??= defaultPrefix;
  if (isExpo && !flags.prefix) throw new Error('Expo requires a nonempty immutable release prefix.');
  options.signal?.throwIfAborted();
  const config = await initializeConfig(flags, cwd);
  if (isExpo) {
    const source = await readFile(config, 'utf8');
    await writeFile(config, source
      .replace('Glob patterns are relative to root (omit "public/"). Your framework still serves these files.', 'Glob patterns are relative to root. Excluded images keep their local sources.')
      .replace('Example: ["favicon.ico", "fonts/**", "offline/**", "images/fallback.png"]', 'Example: ["essential/**", "offline/**", "fallback.png"]')
      .replace('  "root":', '  // Expo: manage only images intended for CDN delivery. Keep icons, splash screens and offline assets local.\n  "root":')
      .replace('    "prefix":', '    // Native releases: use a unique immutable prefix with a matching publicBaseUrl.\n    // Retain older prefixes for installed apps and OTA rollback.\n    "prefix":'));
  }
  const warnings: string[] = ['After migration, commit the configured deployment-state file with the matching assets so CI can build.'];
  if (flags.provider !== 's3' && flags.provider && !flags.endpoint) warnings.push('Set storage.endpoint in simpcn.config.ts before planning or migrating.');
  if (!flags['public-base-url']) warnings.push('Set publicBaseUrl in simpcn.config.ts before building with the framework plugin.');
  warnings.push('The bucket must already exist; init does not create buckets or change public access.');
  const directory = path.dirname(config);
  const template = path.join(directory, '.env.example');
  if (!await exists(template)) await writeFile(template, 'AWS_ACCESS_KEY_ID=\nAWS_SECRET_ACCESS_KEY=\n# AWS_SESSION_TOKEN=\n', { flag: 'wx' });
  const ignorePath = path.join(directory, '.gitignore');
  const ignore = await exists(ignorePath) ? await readFile(ignorePath, 'utf8') : '';
  const missing = ['.env', '.env.local', 'simpcn/.build/', 'simpcn/*.lock', 'simpcn/*.tmp'].filter(line => !ignore.split(/\r?\n/).includes(line));
  if (missing.length) await writeFile(ignorePath, ignore + (ignore.endsWith('\n') || !ignore ? '' : '\n') + missing.join('\n') + '\n');
  if (flags.framework === 'vite' || flags.framework === 'next' || isExpo) {
    const packageName = isExpo ? '@simpcn/expo' : flags.framework === 'next' ? '@simpcn/next' : '@simpcn/vite';
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
    if (isExpo) {
      warnings.push('In metro.config.js, require { withSimpcn } from "@simpcn/expo/metro" and export its promise: module.exports = withSimpcn(existingMetroConfig); preserve your existing expo/metro-config setup.');
      warnings.push('Expo prototype: iOS/Android PNG/JPEG image sources and variants only. Device, EAS and OTA validation are pending; Expo web and bare React Native are not supported.');
      warnings.push('Put managed images in the configured root (default assets/cdn). Use a unique immutable storage.prefix and matching publicBaseUrl per release, and retain previous releases. Development and excluded assets stay local.');
    } else if (flags.framework === 'next') {
      warnings.push('In next.config.ts or next.config.mjs, add import { withSimpcn } from "@simpcn/next"; then wrap your existing config: export default withSimpcn(nextConfig);');
      warnings.push('Next.js adapter prototype: regular JSX media references, verified static next/image and assetUrl() are supported; CSS rewriting is not implemented.');
    } else warnings.push('Add import { simpcn } from "@simpcn/vite" to your Vite config, then put simpcn() first in its plugins array.');
  }
  return { config, framework: flags.framework, warnings };
}
