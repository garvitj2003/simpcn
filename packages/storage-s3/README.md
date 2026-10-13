# @simpcn/storage-s3

S3-compatible storage adapter for `@simpcn/core`, tested against local MinIO.

```ts
import { createMinioAdapter } from '@simpcn/storage-s3';
import { executeMigration, LocalDeploymentStateStore } from '@simpcn/core';

const adapter = createMinioAdapter({
  endpoint: 'http://192.168.1.14:9000',
  bucket: 'simpcn-test',
  region: 'us-east-1',
  prefix: 'mvp',
});
// Credentials come from the AWS SDK chain, including AWS_ACCESS_KEY_ID and
// AWS_SECRET_ACCESS_KEY. They are not stored in deployment state.
try {
  const report = await executeMigration(plan, {
    root: './public', adapter,
    stateStore: new LocalDeploymentStateStore('.simpcn/minio-state.json'),
  });
} finally { adapter.close(); }
```

`S3StorageAdapter` also accepts `endpoint`, `region`, `bucket`, `prefix`,
`forcePathStyle`, and optional explicit `credentials`. The MinIO factory enables
path-style addressing. Omit `endpoint` to use AWS S3. Other S3-compatible services
must be integration-tested for their conditional PUT behavior; S3 compatibility
does not imply identical capabilities.

`head` returns null only for a missing object response, preserving authentication,
bucket and network errors. Uploads stream fresh bodies with content length,
content type, cache policy and `simpcn-sha256` metadata. Both create-only and
ETag-conditional replacement requests are supported. Provider ETags are used as
opaque concurrency tokens, never as SHA-256 fingerprints.

SDK retries are disabled so the executor owns retry policy and stream reopening.
Uploads above 5 GiB are rejected before opening a body; multipart is future work.
No remote deletion, bucket creation, CDN setup, URL generation, or purge operations
are performed. The caller chooses public delivery configuration separately.
