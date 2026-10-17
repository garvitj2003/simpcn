import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { initializeProject } from '../src/init.js';
import { loadEnvironment } from '../src/environment.js';
import { loadConfig } from '../src/config.js';
import { runCli } from '../src/run.js';
import { version } from '../src/version.js';

let cwd: string;
beforeEach(async () => { cwd = await mkdtemp(path.join(tmpdir(), 'simpcn-setup-')); });
afterEach(async () => { vi.unstubAllEnvs(); await rm(cwd, { recursive: true, force: true }); });
const pkg = async (extra = {}) => writeFile(path.join(cwd, 'package.json'), JSON.stringify({ name: '@team/My_App', ...extra }));

it('connects init to TS defaults and leaves an existing Vite config untouched', async () => {
  await pkg({ devDependencies: { vite: '^8', '@simpcn/vite': '0.1.0' } });
  const vite = 'export default { plugins: [] };\n';
  await writeFile(path.join(cwd, 'vite.config.ts'), vite);
  let out = '';
  expect(await runCli(['init', '--json'], { cwd, stdout: s => { out += s; }, stderr: () => {} })).toBe(0);
  expect(JSON.parse(out).framework).toBe('vite');
  const config = await loadConfig({}, cwd);
  expect(config.storage).toMatchObject({ bucket: 'my-app', prefix: 'assets', provider: 's3' });
  expect(config.publicBaseUrl).toBeUndefined();
  expect(await readFile(path.join(cwd, 'vite.config.ts'), 'utf8')).toBe(vite);
  const source = await readFile(path.join(cwd, 'simpcn.config.ts'), 'utf8');
  await writeFile(path.join(cwd, 'simpcn.config.ts'), source.replace('// publicBaseUrl:', 'publicBaseUrl:'));
  expect((await loadConfig({}, cwd)).publicBaseUrl).toBe('https://cdn.example.com/assets/');
});
it('runs the wizard, uses the project package manager and creates credential guidance', async () => {
  await pkg({ packageManager: 'pnpm@12.11.2', devDependencies: { vite: '^8' } });
  const choices = ['vite', 'minio'];
  const answers = ['us-east-1', 'chosen-bucket', 'images'];
  const install = vi.fn(async () => {});
  const result = await initializeProject({ endpoint: 'http://127.0.0.1:9000' }, cwd, { interactive: true, select: async () => choices.shift()!, ask: async () => answers.shift()!, install });
  expect(install).toHaveBeenCalledWith('pnpm', ['add', '-D', `@simpcn/vite@${version}`], cwd);
  expect((await loadConfig({}, cwd)).storage).toMatchObject({ bucket: 'chosen-bucket', prefix: 'images', provider: 'minio' });
  expect(result.warnings.join(' ')).toContain('Vite config');
  expect(await readFile(path.join(cwd, '.gitignore'), 'utf8')).toContain('.env.local');
  expect(await readFile(path.join(cwd, '.env.example'), 'utf8')).toContain('AWS_ACCESS_KEY_ID=');
});
it('preserves existing templates and refuses repeated init', async () => {
  await pkg();
  await writeFile(path.join(cwd, '.env.example'), 'KEEP=this\n');
  await initializeProject({ yes: true }, cwd);
  await expect(initializeProject({ yes: true }, cwd)).rejects.toThrow('already exists');
  expect(await readFile(path.join(cwd, '.env.example'), 'utf8')).toBe('KEEP=this\n');
});
it('detects an installed Next adapter and preserves existing Next config', async () => {
  await pkg({ dependencies: { next: '^16.4.0' }, devDependencies: { '@simpcn/next': '0.1.0' } });
  const source = 'export default {basePath:"/docs"};\n';
  await writeFile(path.join(cwd, 'next.config.ts'), source);
  const install = vi.fn(async () => {});
  const result = await initializeProject({ yes: true }, cwd, { install });
  expect(result.framework).toBe('next');
  expect(install).not.toHaveBeenCalled();
  expect(result.warnings.join(' ')).toContain('withSimpcn(nextConfig)');
  expect(result.warnings.join(' ')).toContain('not implemented');
  expect(await readFile(path.join(cwd, 'next.config.ts'), 'utf8')).toBe(source);
});
it('installs the Next adapter with the project package manager', async () => {
  await pkg({ dependencies: { next: '^16.4.0' }, packageManager: 'npm@11' });
  const install = vi.fn(async () => {});
  const result = await initializeProject({ framework: 'next', yes: true }, cwd, { install });
  expect(result.framework).toBe('next');
  expect(install).toHaveBeenCalledWith('npm', ['install', '-D', `@simpcn/next@${version}`], cwd);
});
it('offers Next in the menu and preselects it for a Next project', async () => {
  await pkg({ dependencies: { next: '^16.4.0' }, devDependencies: { '@simpcn/next': '0.1.0' } });
  const select = vi.fn(async (_message, _choices, fallback) => fallback);
  const result = await initializeProject({}, cwd, { interactive: true, select, ask: async (_message, fallback) => fallback });
  expect(result.framework).toBe('next');
  expect(select.mock.calls[0][1]).toContainEqual({ name: 'Next.js (Turbopack / webpack)', value: 'next' });
  expect(select.mock.calls[0][2]).toBe('next');
});
it('uses a local Next archive for unpublished setup through the CLI', async () => {
  await pkg({ dependencies: { next: '^16.4.0' } });
  const archive = path.join(cwd, 'simpcn-next-0.1.0.tgz');
  await writeFile(archive, 'archive fixture');
  const install = vi.fn(async () => {});
  let output = '';
  expect(await runCli(['init', '--framework', 'next', '--integration-package', archive, '--json'], {
    cwd, stdout: text => { output += text; }, stderr: () => {}, setup: { install },
  })).toBe(0);
  expect(JSON.parse(output).framework).toBe('next');
  expect(install).toHaveBeenCalledWith('npm', ['install', '-D', archive], cwd);
});
it('loads env precedence without exposing values or replacing shell variables', async () => {
  await writeFile(path.join(cwd, '.env'), 'KEY=base\nONLY_BASE="a b"\nSHELL=base\n');
  await writeFile(path.join(cwd, '.env.local'), 'KEY=local\nSHELL=local\n');
  const environment = { SHELL: 'existing' } as NodeJS.ProcessEnv;
  await loadEnvironment(cwd, environment);
  expect(environment).toEqual({ SHELL: 'existing', KEY: 'local', ONLY_BASE: 'a b' });
});
it('loads env beside the discovered config before evaluating TS from a child directory', async () => {
  vi.stubEnv('SIMPCN_TEST_BUCKET', undefined);
  await mkdir(path.join(cwd, 'nested'));
  await mkdir(path.join(cwd, 'public'));
  await writeFile(path.join(cwd, '.env.local'), 'SIMPCN_TEST_BUCKET=from-env\n');
  await writeFile(path.join(cwd, 'simpcn.config.ts'), 'export default {storage:{bucket:process.env.SIMPCN_TEST_BUCKET}};');
  let output = '';
  expect(await runCli(['plan', '--json'], { cwd: path.join(cwd, 'nested'), stdout: s => { output += s; }, stderr: () => {} })).toBe(0);
  expect(JSON.parse(output).target.bucket).toBe('from-env');
});
it('rejects obvious provider mismatches', async () => {
  for (const storage of [
    { provider: 's3', endpoint: 'https://account.r2.cloudflarestorage.com' },
    { provider: 'minio', endpoint: 'https://s3.us-east-1.amazonaws.com' },
    { provider: 'r2', endpoint: 'https://account.r2.cloudflarestorage.com', region: 'us-east-1' },
  ]) {
    await writeFile(path.join(cwd, 'simpcn.config.ts'), 'export default ' + JSON.stringify({ storage: { bucket: 'test', ...storage } }));
    await expect(loadConfig({}, cwd)).rejects.toThrow(/provider|region/);
  }
});
it('reports install failure while preserving generated settings', async () => {
  await pkg({ devDependencies: { vite: '^8' } });
  await expect(initializeProject({ provider: 'minio', endpoint: 'http://localhost:9000' }, cwd,
    { install: async () => { throw Error('network unavailable'); } })).rejects.toThrow('integration installation failed');
  expect((await loadConfig({}, cwd)).storage.provider).toBe('minio');
});

it('uses menus and defers endpoint and public URL input to config', async () => {
  await pkg();
  const choices = ['core', 'minio'];
  const select = vi.fn(async () => choices.shift()!);
  const ask = vi.fn(async (_message: string, fallback: string) => fallback);
  const result = await initializeProject({}, cwd, { interactive: true, select, ask, install: vi.fn(async () => {}) });
  expect(select).toHaveBeenCalledTimes(2);
  expect(ask.mock.calls.map(([message]) => message).join(' ')).not.toMatch(/endpoint|URL/i);
  expect(result.warnings.join(' ')).toContain('storage.endpoint');
  const filename = path.join(cwd, 'simpcn.config.ts');
  const source = await readFile(filename, 'utf8');
  expect(source).toContain('// endpoint: "http://localhost:9000"');
  await expect(loadConfig({}, cwd)).rejects.toThrow('Set storage.endpoint');
  await writeFile(filename, source.replace('// endpoint:', 'endpoint:'));
  expect((await loadConfig({}, cwd)).storage.endpoint).toBe('http://localhost:9000');
});

it('cancels the wizard without writing configuration', async () => {
  const select = async () => { const error = new Error('cancel'); error.name = 'ExitPromptError'; throw error; };
  let output = '';
  const code = await runCli(['init'], { cwd, setup: { interactive: true, select }, stdout: () => {}, stderr: text => { output += text; } });
  expect(code).toBe(130);
  expect(output).toContain('Setup cancelled');
  await expect(readFile(path.join(cwd, 'simpcn.config.ts'))).rejects.toMatchObject({ code: 'ENOENT' });
});

const git = promisify(execFile);
it.each([false, true])('keeps deployment state trackable and ignores generated files (existing ignore: %s)', async existing => {
  await pkg();
  if (existing) await writeFile(path.join(cwd, '.gitignore'), 'node_modules/\ncustom-output/');
  await initializeProject({ yes: true }, cwd);
  await git('git', ['init', '--quiet', cwd]);
  await mkdir(path.join(cwd, 'simpcn', '.build'), { recursive: true });
  const tracked = ['simpcn.config.ts', 'simpcn/deployment-state.json'];
  const ignored = ['simpcn/.build/manifest.json', 'simpcn/.build/next/helper.js', 'simpcn/deployment-state.json.lock', 'simpcn/deployment-state.json.test.tmp', '.env.local'];
  for (const file of tracked) {
    await expect(git('git', ['check-ignore', '--no-index', file], { cwd })).rejects.toMatchObject({ code: 1 });
  }
  const result = await git('git', ['check-ignore', '--no-index', ...ignored], { cwd });
  expect(result.stdout.trim().split('\n')).toEqual(ignored);
  const config = await loadConfig({}, cwd);
  expect(config.stateFile).toBe(path.join(cwd, 'simpcn/deployment-state.json'));
  expect(config.manifestFile).toBe(path.join(cwd, 'simpcn/.build/manifest.json'));
  if (existing) expect(await readFile(path.join(cwd, '.gitignore'), 'utf8')).toContain('node_modules/\ncustom-output/\n');
});
it('preserves explicitly configured legacy state and manifest paths', async () => {
  await writeFile(path.join(cwd, 'simpcn.config.ts'), 'export default {storage:{bucket:"test"},stateFile:".simpcn/deployment-state.json",manifestFile:".simpcn/manifest.json"}');
  const config = await loadConfig({}, cwd);
  expect(config.stateFile).toBe(path.join(cwd, '.simpcn/deployment-state.json'));
  expect(config.manifestFile).toBe(path.join(cwd, '.simpcn/manifest.json'));
});
it('detects Expo ahead of web frameworks and installs its matching adapter', async () => {
  await pkg({ packageManager: 'pnpm@12.11.2', dependencies: { expo: '58.0.14', next: '^16.4', vite: '^8' } });
  const metro = 'module.exports = existingWrapper(existingConfig);\n';
  await writeFile(path.join(cwd, 'metro.config.js'), metro);
  const install = vi.fn(async () => {});
  let out = '';
  expect(await runCli(['init', '--yes', '--json'], { cwd, setup: { install }, stdout: text => { out += text; }, stderr: () => {} })).toBe(0);
  expect(JSON.parse(out).framework).toBe('expo');
  expect(install).toHaveBeenCalledWith('pnpm', ['add', '-D', `@simpcn/expo@${version}`], cwd);
  const config = await loadConfig({}, cwd);
  expect(config.root).toBe(path.join(cwd, 'assets/cdn'));
  expect(config.storage.prefix).toBe('releases/v1');
  const source = await readFile(path.join(cwd, 'simpcn.config.ts'), 'utf8');
  expect(source).toContain('unique immutable prefix');
  expect(source).toContain('https://cdn.example.com/releases/v1/');
  const warnings = JSON.parse(out).warnings.join(' ');
  expect(warnings).toContain('@simpcn/expo/metro');
  expect(await readFile(path.join(cwd, 'metro.config.js'), 'utf8')).toBe(metro);
});
it('offers Expo in the wizard without endpoint or credential prompts', async () => {
  await pkg({ dependencies: { expo: '58.0.14' } });
  const select = vi.fn(async (_question, _choices, fallback) => fallback);
  const ask = vi.fn(async (_question, fallback) => fallback);
  const result = await initializeProject({}, cwd, { interactive: true, select, ask, install: vi.fn(async () => {}) });
  expect(result.framework).toBe('expo');
  expect(select.mock.calls[0][2]).toBe('expo');
  expect(select.mock.calls[0][1]).toContainEqual({ name: 'Expo (iOS / Android, experimental)', value: 'expo' });
  expect(ask.mock.calls.map(([question]) => question).join(' ')).not.toMatch(/endpoint|credentials|URL/i);
});
it('installs a local Expo adapter archive and preserves custom root and release namespace', async () => {
  await pkg({ packageManager: 'pnpm@12.11.2', dependencies: { expo: '58.0.14' } });
  const archive = path.join(cwd, 'simpcn-expo-test.tgz');
  await writeFile(archive, 'fixture');
  const install = vi.fn(async () => {});
  let out = '';
  expect(await runCli(['init', '--framework', 'expo', '--root', 'images', '--prefix', 'release-42', '--integration-package', archive, '--json'], { cwd, setup: { install }, stdout: text => { out += text; }, stderr: () => {} })).toBe(0);
  expect(JSON.parse(out).framework).toBe('expo');
  expect(install).toHaveBeenCalledWith('pnpm', ['add', '-D', archive], cwd);
  const config = await loadConfig({}, cwd);
  expect(config.root).toBe(path.join(cwd, 'images'));
  expect(config.storage.prefix).toBe('release-42');
});
it('preserves R2 guidance in Expo config and recognizes an installed adapter', async () => {
  await pkg({ dependencies: { expo: '58.0.14' }, devDependencies: { '@simpcn/expo': '0.1.2' } });
  const install = vi.fn(async () => {});
  const result = await initializeProject({ yes: true, provider: 'r2', prefix: 'releases/mobile-v2' }, cwd, { install });
  expect(install).not.toHaveBeenCalled();
  const source = await readFile(result.config, 'utf8');
  expect(source).toContain('remove /bucket-name');
  expect(source).toContain('https://pub-YOUR_ID.r2.dev/releases/mobile-v2/');
  expect(source).toContain('Native releases');
});
it('rejects an empty native release prefix before writing config', async () => {
  await pkg({ dependencies: { expo: '58.0.14' } });
  await expect(initializeProject({ yes: true, prefix: '' }, cwd)).rejects.toThrow('nonempty immutable release prefix');
  await expect(readFile(path.join(cwd, 'simpcn.config.ts'))).rejects.toMatchObject({ code: 'ENOENT' });
});
it('honors skip-install even when a local Expo archive is supplied', async () => {
  await pkg({ dependencies: { expo: '58.0.14' } });
  const archive = path.join(cwd, 'adapter.tgz');
  await writeFile(archive, 'fixture');
  const install = vi.fn(async () => {});
  const result = await initializeProject({ yes: true, 'skip-install': true, 'integration-package': archive }, cwd, { install });
  expect(install).not.toHaveBeenCalled();
  expect(result.warnings.join(' ')).toContain('Install @simpcn/expo');
});
