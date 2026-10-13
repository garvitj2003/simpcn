import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

describe.runIf(process.env.SIMPCN_MINIO_TEST === '1')('CLI against live MinIO', () => {
  it('initializes, plans, migrates, blocks conflicts and recovers from an authentication failure', async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), 'simpcn-cli-live-'));
    const bin = fileURLToPath(new URL('../dist/bin.js', import.meta.url));
    const call = (args: string[], env = process.env) => {
      const result = spawnSync(process.execPath, [bin, ...args, '--json'], { cwd, env, encoding: 'utf8', timeout: 10_000 });
      if (result.error) throw result.error;
      expect(result.stderr).toBe('');
      return { code: result.status, output: JSON.parse(result.stdout) };
    };
    try {
      await mkdir(path.join(cwd, 'public'));
      await writeFile(path.join(cwd, 'public', 'asset.txt'), 'before');
      await writeFile(path.join(cwd, 'public', 'empty.txt'), '');
      expect(call(['init', '--provider', 'minio', '--endpoint', process.env.S3_ENDPOINT ?? 'http://192.168.1.14:9000',
        '--bucket', process.env.S3_BUCKET ?? 'simpcn-test', '--region', process.env.S3_REGION ?? 'us-east-1',
        '--prefix', `${process.env.S3_PREFIX ?? 'mvp'}/cli-integration`]).code).toBe(0);
      const planned = call(['plan']);
      expect(planned.code).toBe(0);
      expect(planned.output.summary.added).toBe(2);
      const migrated = call(['migrate', '--overwrite']);
      expect(migrated.code).toBe(0);
      expect(migrated.output.summary.uploaded + migrated.output.summary.skipped).toBe(2);
      expect(call(['migrate']).output.summary.skipped).toBe(2);
      await writeFile(path.join(cwd, 'public', 'asset.txt'), 'after');
      const remote = call(['plan', '--check-remote']);
      expect(remote.code).toBe(1);
      expect(remote.output.remote.find((item: { key: string }) => item.key.endsWith('/asset.txt')).decision).toBe('conflict');
      expect(call(['migrate']).code).toBe(1);
      const replaced = call(['migrate', '--overwrite']);
      expect(replaced.code).toBe(0);
      expect(replaced.output.summary).toMatchObject({ uploaded: 1, replaced: 1, skipped: 1 });
      await writeFile(path.join(cwd, 'public', 'recovery.txt'), 'recovery');
      const denied = call(['migrate'], { ...process.env, AWS_ACCESS_KEY_ID: 'simpcn-invalid-test-key', AWS_SECRET_ACCESS_KEY: 'simpcn-invalid-test-secret' });
      expect(denied.code).toBe(1);
      expect(denied.output.results.every((item: { errorCode: string }) => item.errorCode === 'auth')).toBe(true);
      const recovered = call(['migrate', '--overwrite']);
      expect(recovered.code).toBe(0);
      expect(recovered.output.summary.skipped).toBeGreaterThanOrEqual(2);
      expect(call(['plan']).output.summary.unchanged).toBe(3);
    } finally { await rm(cwd, { recursive: true, force: true }); }
  }, 30_000);
});
