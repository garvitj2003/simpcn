import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Readable } from 'node:stream';
import { StorageError, type UploadInput } from '@simpcn/core';
const { send, destroy } = vi.hoisted(() => ({ send: vi.fn(), destroy: vi.fn() }));
vi.mock('@aws-sdk/client-s3', async importOriginal => {
  const actual = await importOriginal<typeof import('@aws-sdk/client-s3')>();
  return { ...actual, S3Client: class { send = send; destroy = destroy; } };
});
import { createMinioAdapter } from '../src/index.js';
const create = () => createMinioAdapter({ endpoint: 'http://192.168.1.14:9000', bucket: 'simpcn-test', region: 'us-east-1' });
const upload = (): UploadInput => ({ key: 'asset.txt', size: 5, sha256: 'a'.repeat(64),
  mimeType: 'text/plain', cacheControl: 'public, max-age=0, must-revalidate',
  condition: { ifAbsent: true }, openBody: async () => Readable.from(['bytes']) });
beforeEach(() => { send.mockReset(); destroy.mockReset(); });

describe('S3 adapter', () => {
  it('maps remote metadata and distinguishes missing keys from failed HEAD requests', async () => {
    send.mockResolvedValueOnce({ ContentLength: 5, ContentType: 'text/plain', ETag: '"etag"',
      Metadata: { 'simpcn-sha256': 'hash' }, CacheControl: 'max-age=0' });
    expect(await create().head('asset.txt')).toEqual({ key: 'asset.txt', size: 5,
      mimeType: 'text/plain', etag: '"etag"', sha256: 'hash', cacheControl: 'max-age=0' });
    send.mockRejectedValueOnce({ name: 'NotFound', $metadata: { httpStatusCode: 404 } });
    expect(await create().head('missing')).toBeNull();
    send.mockRejectedValueOnce({ name: 'AccessDenied', $metadata: { httpStatusCode: 403 } });
    await expect(create().head('secret')).rejects.toMatchObject({ code: 'auth' });
    send.mockRejectedValueOnce({ name: 'NoSuchBucket', $metadata: { httpStatusCode: 404 } });
    await expect(create().head('asset')).rejects.toMatchObject({ code: 'not-found' });
  });
  it('streams uploads with length, MIME, SHA metadata and create-only preconditions', async () => {
    const body = Readable.from(['bytes']);
    send.mockImplementationOnce(async command => {
      expect(command.input).toMatchObject({ Bucket: 'simpcn-test', Key: 'asset.txt', Body: body,
        ContentLength: 5, ContentType: 'text/plain', IfNoneMatch: '*', Metadata: { 'simpcn-sha256': 'a'.repeat(64) } });
      for await (const _ of command.input.Body) { /* consume */ }
      return { ETag: '"etag"' };
    });
    expect(await create().upload({ ...upload(), openBody: async () => body })).toEqual({ etag: '"etag"' });
    expect(body.destroyed).toBe(true);
  });
  it('uses If-Match for replacements and destroys failed upload streams', async () => {
    const body = Readable.from(['bytes']);
    send.mockRejectedValueOnce({ name: 'PreconditionFailed', $metadata: { httpStatusCode: 412 } });
    await expect(create().upload({ ...upload(), condition: { ifMatch: '"old"' }, openBody: async () => body })).rejects.toMatchObject({ code: 'conflict' });
    expect(send.mock.calls[0][0].input.IfMatch).toBe('"old"');
    expect(body.destroyed).toBe(true);
  });
  it('classifies retryable network errors and server failures', async () => {
    for (const error of [{ code: 'ECONNRESET' }, { $metadata: { httpStatusCode: 503 } }]) {
      send.mockRejectedValueOnce(error);
      await expect(create().head('asset')).rejects.toBeInstanceOf(StorageError);
      send.mockRejectedValueOnce(error);
      await expect(create().head('asset')).rejects.toMatchObject({ code: 'transient' });
    }
  });
  it('validates endpoint and prefix configuration and rejects oversized uploads', async () => {
    expect(() => createMinioAdapter({ endpoint: 'http://user:password@host:9000', bucket: 'test', region: 'us-east-1' })).toThrow('endpoint');
    expect(() => createMinioAdapter({ endpoint: 'http://host:9000', prefix: '../outside', bucket: 'test', region: 'us-east-1' })).toThrow('prefix');
    await expect(create().upload({ ...upload(), size: 5 * 1024 ** 3 + 1 })).rejects.toThrow('multipart');
    expect(send).not.toHaveBeenCalled();
    create().close();
    expect(destroy).toHaveBeenCalled();
  });
});
