import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { generateManifest, diffManifests, planMigration, executeMigration, LocalDeploymentStateStore } from '@simpcn/core';
import { createMinioAdapter } from '../src/index.js';

// Opt-in integration tests write only to a dedicated prefix. They never delete remote objects.
describe.runIf(process.env.SIMPCN_MINIO_TEST === '1')('live MinIO', () => {
  it('uploads real streams, verifies downloaded bytes, blocks conflicts, and replaces changed assets explicitly', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'simpcn-minio-live-'));
    const root = path.join(directory, 'public');
    await mkdir(root);
    const endpoint = process.env.S3_ENDPOINT ?? 'http://192.168.1.14:9000';
    const bucket = process.env.S3_BUCKET ?? 'simpcn-test';
    const region = process.env.S3_REGION ?? 'us-east-1';
    const prefix = `${process.env.S3_PREFIX ?? 'mvp'}/integration`;
    const adapter = createMinioAdapter({ endpoint, bucket, region, prefix });
    const client = new S3Client({ endpoint, region, forcePathStyle: true,
      requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
    const stateStore = new LocalDeploymentStateStore(path.join(directory, 'state.json'));
    try {
      await writeFile(path.join(root, 'empty.txt'), '');
      await writeFile(path.join(root, 'spaced #asset.bin'), Buffer.alloc(6 * 1024 * 1024, 42));
      await writeFile(path.join(root, 'changed.txt'), 'before');
      const initial = await generateManifest({ root });
      const firstPlan = planMigration(diffManifests({ version: 1, assets: [] }, initial));
      // Repeatable fixed test keys may remain from an earlier test run.
      const first = await executeMigration(firstPlan, { root, adapter, stateStore, overwrite: true });
      expect(first.success).toBe(true);
      expect(first.state.assets.every(record => record.status === 'verified')).toBe(true);
      for (const asset of initial.assets) {
        const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: `${prefix}/${asset.storageKey}` }));
        const hash = createHash('sha256');
        for await (const chunk of response.Body as AsyncIterable<Uint8Array>) hash.update(chunk);
        expect(hash.digest('hex')).toBe(asset.hash);
      }
      const repeated = await executeMigration(planMigration(diffManifests(initial, initial)), { root, adapter, stateStore });
      expect(repeated.results.every(result => result.status === 'skipped')).toBe(true);
      await writeFile(path.join(root, 'changed.txt'), 'after');
      const current = await generateManifest({ root });
      const changedPlan = planMigration(diffManifests(initial, current));
      const blocked = await executeMigration(changedPlan, { root, adapter, stateStore });
      expect(blocked.success).toBe(false);
      expect(blocked.results.find(result => result.key.endsWith('/changed.txt'))?.errorCode).toBe('conflict');
      const replaced = await executeMigration(changedPlan, { root, adapter, stateStore, overwrite: true });
      expect(replaced.success).toBe(true);
      const changed = replaced.results.find(result => result.key.endsWith('/changed.txt'))!;
      expect(changed.status).toBe('uploaded');
      expect(changed.replaced).toBe(true);
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: `${prefix}/changed.txt` }));
      expect(await response.Body!.transformToString()).toBe('after');
    } finally {
      adapter.close();
      client.destroy();
      await rm(directory, { recursive: true, force: true });
    }
  }, 30_000);
});
