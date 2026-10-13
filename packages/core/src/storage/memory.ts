import type { StorageAdapter, StorageTarget, RemoteAsset, UploadInput, UploadResult } from './types.js';
import { StorageError } from './types.js';

/** Test adapter. Buffers bytes; production adapters must stream them. */
export class MemoryStorageAdapter implements StorageAdapter {
  readonly objects = new Map<string, RemoteAsset & { body: Buffer }>();
  private revision = 0;
  constructor(readonly target: StorageTarget = { service: 'memory', bucket: 'test', prefix: '' }) {}
  async head(key: string, signal?: AbortSignal): Promise<RemoteAsset | null> {
    signal?.throwIfAborted();
    const object = this.objects.get(key);
    if (!object) return null;
    const { body: _, ...metadata } = object;
    return { ...metadata };
  }
  async upload(input: UploadInput): Promise<UploadResult> {
    input.signal?.throwIfAborted();
    const chunks: Buffer[] = [];
    const body = await input.openBody();
    try {
      for await (const chunk of body) { input.signal?.throwIfAborted(); chunks.push(Buffer.from(chunk)); }
    } finally { body.destroy(); }
    const existing = this.objects.get(input.key);
    if (('ifAbsent' in input.condition && existing) ||
        ('ifMatch' in input.condition && existing?.etag !== input.condition.ifMatch)) {
      throw new StorageError('Object changed before upload', 'conflict');
    }
    const bytes = Buffer.concat(chunks);
    if (bytes.length !== input.size) throw new StorageError('Upload length mismatch', 'unknown');
    const etag = `"memory-${++this.revision}"`;
    this.objects.set(input.key, { key: input.key, body: bytes, size: bytes.length,
      mimeType: input.mimeType, sha256: input.sha256, cacheControl: input.cacheControl, etag });
    return { etag };
  }
}
