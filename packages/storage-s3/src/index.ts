import { HeadObjectCommand, PutObjectCommand, S3Client, type S3ClientConfig } from '@aws-sdk/client-s3';
import { resolveStorageTarget as resolveS3Target, StorageError, type RemoteAsset, type StorageAdapter, type StorageTarget,
  type UploadInput, type UploadResult } from '@simpcn/core';

export interface S3StorageOptions {
  bucket: string;
  region: string;
  endpoint?: string;
  prefix?: string;
  forcePathStyle?: boolean;
  /** Omit to use the AWS SDK credential chain, including environment variables. */
  credentials?: S3ClientConfig['credentials'];
}

function normalizeError(error: unknown): StorageError {
  if (error instanceof StorageError) return error;
  const e = error as { name?: string; code?: string; $metadata?: { httpStatusCode?: number } };
  const status = e?.$metadata?.httpStatusCode;
  const name = e?.name ?? e?.code;
  if (name === 'AbortError') return new StorageError('Storage request cancelled', 'aborted', { cause: error });
  if (status === 401 || status === 403 || name === 'CredentialsProviderError') {
    return new StorageError('Storage authentication or permission denied', 'auth', { cause: error });
  }
  if (status === 409 || status === 412) return new StorageError('Storage object changed concurrently', 'conflict', { cause: error });
  if (status === 429 || (status !== undefined && status >= 500) ||
      ['TimeoutError', 'RequestTimeout', 'SlowDown', 'ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED'].includes(name ?? '') ||
      ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED'].includes(e?.code ?? '')) {
    return new StorageError('Transient storage request failure', 'transient', { cause: error });
  }
  if (status === 404) return new StorageError('Storage resource not found', 'not-found', { cause: error });
  return new StorageError('Storage request failed', 'unknown', { cause: error });
}

export { resolveStorageTarget as resolveS3Target } from '@simpcn/core';

export class S3StorageAdapter implements StorageAdapter {
  readonly target: StorageTarget;
  private readonly client: S3Client;
  constructor(options: S3StorageOptions) {
    this.target = resolveS3Target(options);
    const endpoint = options.endpoint ? this.target.service : undefined;
    this.client = new S3Client({ region: options.region, endpoint, credentials: options.credentials,
      forcePathStyle: options.forcePathStyle ?? false, maxAttempts: 1,
      requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED' });
  }

  async head(key: string, signal?: AbortSignal): Promise<RemoteAsset | null> {
    try {
      const result = await this.client.send(new HeadObjectCommand({ Bucket: this.target.bucket, Key: key }), { abortSignal: signal });
      if (result.ContentLength === undefined) throw new StorageError('Object metadata has no content length', 'unknown');
      return { key, size: result.ContentLength, mimeType: result.ContentType,
        sha256: result.Metadata?.['simpcn-sha256'], cacheControl: result.CacheControl, etag: result.ETag };
    } catch (error) {
      const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (e?.$metadata?.httpStatusCode === 404 && ['NotFound', 'NoSuchKey'].includes(e.name ?? '')) return null;
      throw normalizeError(error);
    }
  }

  async upload(input: UploadInput): Promise<UploadResult> {
    // MVP uses conditional single-part PUTs; do not silently buffer or split oversized files.
    if (input.size > 5 * 1024 ** 3) throw new StorageError('Assets above 5 GiB require multipart upload, which is not supported yet', 'unknown');
    input.signal?.throwIfAborted();
    const body = await input.openBody();
    try {
      const result = await this.client.send(new PutObjectCommand({
        Bucket: this.target.bucket, Key: input.key, Body: body, ContentLength: input.size,
        ContentType: input.mimeType, CacheControl: input.cacheControl,
        Metadata: { 'simpcn-sha256': input.sha256 },
        ...('ifAbsent' in input.condition ? { IfNoneMatch: '*' } : { IfMatch: input.condition.ifMatch }),
      }), { abortSignal: input.signal });
      return { etag: result.ETag };
    } catch (error) { throw normalizeError(error); }
    finally { body.destroy(); }
  }
  close(): void { this.client.destroy(); }
}

export function createMinioAdapter(options: Omit<S3StorageOptions, 'forcePathStyle'> & { endpoint: string }): S3StorageAdapter {
  return new S3StorageAdapter({ ...options, forcePathStyle: true });
}
