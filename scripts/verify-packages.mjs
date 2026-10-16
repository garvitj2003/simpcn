import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, readFile, writeFile, stat, readdir, mkdtemp } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';

// npm is deliberately used only here, inside clean consumer fixtures. The
// workspace itself is installed, built, tested and packed with pnpm.
const exec = promisify(execFile);
const repo = process.cwd();
const archives = path.resolve(process.argv[2] ?? 'artifacts');
const version = JSON.parse(await readFile('packages/cli/package.json', 'utf8')).version;
// Keep it outside the repository: an undeclared import must not accidentally
// resolve through the workspace's parent node_modules.
const cwd = await mkdtemp(path.join(tmpdir(), 'simpcn-consumer-'));
await writeFile(path.join(cwd, 'package.json'), JSON.stringify({ name: 'simpcn-packaging-proof', private: true }));
const archive = name => path.join(archives, `simpcn${name ? '-' + name : ''}-${version}.tgz`);
const install = async names => exec('npm', ['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--legacy-peer-deps', ...names.map(archive)], { cwd });
const lock = async () => JSON.parse(await readFile(path.join(cwd, 'package-lock.json'), 'utf8'));
async function bytes(directory) {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const filename = path.join(directory, entry.name);
    total += entry.isDirectory() ? await bytes(filename) : (await stat(filename)).size;
  }
  return total;
}
async function measure(label) {
  const packages = Object.keys((await lock()).packages).filter(Boolean);
  const result = { packages: packages.length, bytes: await bytes(path.join(cwd, 'node_modules')) };
  console.log(label, JSON.stringify(result));
  return result;
}
await install(['', 'core']);
const cliSize = await measure('CLI');
assert.ok(cliSize.packages <= 5, 'CLI installation grew unexpectedly');
const bin = path.join(cwd, 'node_modules/simpcn/dist/bin.js');
assert.match((await exec(process.execPath, [bin, '--help'], { cwd })).stdout, /Usage: simpcn/);
assert.equal((await exec(process.execPath, [bin, '--version'], { cwd })).stdout.trim(), version);
await exec(process.execPath, [bin, 'init', '--framework', 'core', '--yes', '--bucket', 'proof-bucket', '--json'], { cwd });
await mkdir(path.join(cwd, 'public'));
const body = 'packed CLI migration proof';
await writeFile(path.join(cwd, 'public/proof.txt'), body);

// Exercise the bundled S3 SDK over real HTTP, including signing, HEAD, PUT,
// verification and profile-based credential discovery. No external bucket.
let uploaded;
const requests = [];
const server = createServer(async (req, res) => {
  try {
    assert.match(req.headers.authorization ?? '', /AWS4-HMAC-SHA256 Credential=proof-key\//);
    requests.push(req.method);
    if (req.method === 'PUT') {
      assert.equal(req.headers['if-none-match'], '*');
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      uploaded = { body: Buffer.concat(chunks), hash: req.headers['x-amz-meta-simpcn-sha256'] };
      assert.equal(uploaded.body.toString(), body);
      assert.equal(uploaded.hash, createHash('sha256').update(body).digest('hex'));
      res.writeHead(200, { etag: '"proof-etag"' });
    } else if (uploaded) {
      res.writeHead(200, { 'content-length': uploaded.body.length, 'content-type': 'text/plain',
        'x-amz-meta-simpcn-sha256': uploaded.hash, 'cache-control': 'public, max-age=0, must-revalidate', etag: '"proof-etag"' });
    } else res.writeHead(404);
    res.end();
  } catch (error) { res.writeHead(500); res.end(error.message); }
});
await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
try {
  const port = server.address().port;
  const credentials = path.join(cwd, 'test-credentials');
  const configFile = path.join(cwd, 'test-aws-config');
  await writeFile(credentials, '[simpcn-proof]\naws_access_key_id=proof-key\naws_secret_access_key=proof-secret\n');
  await writeFile(configFile, '');
  // Type-only simpcn import exercises the external TS config loader in a
  // consumer that has no dev dependencies or access to workspace symlinks.
  await writeFile(path.join(cwd, 'simpcn.config.ts'), `import type { UserConfig } from 'simpcn';\nexport default {storage:{provider:'minio',endpoint:'http://127.0.0.1:${port}',bucket:'proof-bucket',prefix:'assets'}} satisfies UserConfig;`);
  const env = { ...process.env, AWS_PROFILE: 'simpcn-proof', AWS_SHARED_CREDENTIALS_FILE: credentials, AWS_CONFIG_FILE: configFile, AWS_EC2_METADATA_DISABLED: 'true' };
  delete env.AWS_ACCESS_KEY_ID; delete env.AWS_SECRET_ACCESS_KEY; delete env.AWS_SESSION_TOKEN;
  const result = JSON.parse((await exec(process.execPath, [bin, 'migrate', '--json'], { cwd, env })).stdout);
  assert.equal(result.success, true);
  assert.equal(result.summary.uploaded, 1);
  assert.ok(requests.includes('HEAD') && requests.includes('PUT'));
  const repeat = JSON.parse((await exec(process.execPath, [bin, 'migrate', '--json'], { cwd, env })).stdout);
  assert.equal(repeat.summary.skipped, 1);
} finally { await new Promise(resolve => server.close(resolve)); }

await install(['next', 'transforms-js']);
const nextSize = await measure('CLI + Next adapter (framework peer excluded)');
assert.ok(nextSize.packages <= 10);
const installed = Object.keys((await lock()).packages);
assert.ok(!installed.some(name => /node_modules\/(parse5|postcss|postcss-value-parser|@aws-sdk\/|@smithy\/)/.test(name)));
const js = await import(pathToFileURL(path.join(cwd, 'node_modules/@simpcn/transforms-js/dist/index.js')).href);
const core = await import(pathToFileURL(path.join(cwd, 'node_modules/@simpcn/core/dist/index.js')).href);
const resolver = core.createAssetUrlResolver({ manifest: { version: 1, assets: [] }, target: { service: 'test', bucket: 'test', prefix: '' }, publicBaseUrl: 'https://cdn.example.com/' });
assert.equal(js.transformJs('<img src="/local.png"/>', 'example.tsx', resolver, () => {}), null);
const mapped = { ...resolver, resolve: url => url === '/image.png' ? 'https://cdn.example.com/image.png' : url };
const transformed = js.transformJs('import Picture from "next/image";const image=<Picture src="/image.png"/>;', 'example.tsx', mapped, () => {}, { nextImages: true });
assert.match(transformed.code, /https:\/\/cdn.example.com\/image.png/);
assert.match(transformed.code, /unoptimized/);
assert.ok(transformed.map.sourcesContent.length);
const next = await import(pathToFileURL(path.join(cwd, 'node_modules/@simpcn/next/dist/index.js')).href);
assert.equal(typeof next.withSimpcn, 'function');
await install(['vite', 'transforms']);
const allSize = await measure('CLI + both adapters (framework peers excluded)');
assert.ok(allSize.packages <= 12);
const full = await import(pathToFileURL(path.join(cwd, 'node_modules/@simpcn/transforms/dist/index.js')).href);
assert.equal(full.transformHtml('<img src="/local.png">', resolver), '<img src="/local.png">');
assert.equal(full.transformCss('body{background:url(/local.png)}', 'example.css', resolver), null);
assert.match(full.transformHtml('<img src="/image.png">', mapped), /https:\/\/cdn.example.com\/image.png/);
assert.match(full.transformCss('body{background:url(/image.png)}', 'example.css', mapped).code, /https:\/\/cdn.example.com\/image.png/);
console.log('Packed install, config loading, S3 upload/verification, credential profile and transform imports passed.');
console.log('Consumer fixture:', cwd);
await writeFile(path.join(repo, 'artifacts/packaging-report.json'), JSON.stringify({ cli: cliSize, cliNext: nextSize, cliBoth: allSize, fixture: cwd }, null, 2) + '\n');
