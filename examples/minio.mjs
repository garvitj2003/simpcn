import { mkdir, open, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { generateManifest, diffManifests, planMigration, executeMigration, LocalDeploymentStateStore } from '../packages/core/dist/index.js';
import { createMinioAdapter } from '../packages/storage-s3/dist/index.js';

const execute = process.argv.includes('--execute');
const overwrite = process.argv.includes('--overwrite');
const root = process.env.ASSET_ROOT ?? 'apps/web/public';
const stateFile = process.env.DEPLOYMENT_STATE_FILE ?? '.simpcn/minio-state.json';
const adapter = createMinioAdapter({
  endpoint: process.env.S3_ENDPOINT ?? 'http://192.168.1.14:9000',
  bucket: process.env.S3_BUCKET ?? 'simpcn-test',
  region: process.env.S3_REGION ?? 'us-east-1',
  prefix: process.env.S3_PREFIX ?? 'mvp',
});
const controller = new AbortController();
process.once('SIGINT', () => controller.abort());
let lock;
try {
  if (execute) {
    await mkdir(path.dirname(stateFile), { recursive: true });
    try { lock = await open(`${stateFile}.manifest.lock`, 'wx', 0o600); }
    catch (error) {
      if (error.code === 'EEXIST') throw new Error('Another local migration owns the manifest lock. Check for a running process before removing a stale lock.');
      throw error;
    }
    await lock.writeFile(JSON.stringify({ pid: process.pid }));
  }
  const current = await generateManifest({ root });
  // Keep the complete last local inventory separate from verified deployment history.
  // Removed entries in deployment history remain until an explicit deletion policy exists.
  let previous = { version: 1, assets: [] };
  try { previous = JSON.parse(await readFile(`${stateFile}.manifest.json`, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const plan = planMigration(diffManifests(previous, current));
  if (!execute) {
    console.log(JSON.stringify({ dryRun: true, target: adapter.target, actions: plan }, null, 2));
  } else {
    const report = await executeMigration(plan, { root, adapter,
      stateStore: new LocalDeploymentStateStore(stateFile), overwrite, signal: controller.signal });
    console.log(JSON.stringify({ success: report.success, results: report.results.map(result => ({
      path: result.action.asset.relativePath, key: result.key, status: result.status,
      attempts: result.attempts, replaced: result.replaced, errorCode: result.errorCode, error: result.error,
    })) }, null, 2));
    // A complete successful run becomes the next local baseline; deployment history is separate.
    if (report.success) {
      const temporary = `${stateFile}.manifest.${randomUUID()}.tmp`;
      try {
        await writeFile(temporary, JSON.stringify(current, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
        await rename(temporary, `${stateFile}.manifest.json`);
      } finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
    }
    if (!report.success) process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Migration failed');
  process.exitCode = 1;
} finally {
  adapter.close();
  if (lock) { await lock.close(); await unlink(`${stateFile}.manifest.lock`); }
}
