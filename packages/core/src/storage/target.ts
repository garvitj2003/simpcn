import type { StorageTarget } from './types.js';

export function resolveStorageTarget(options: { bucket: string; region: string; endpoint?: string; prefix?: string }): StorageTarget {
    if (!options.bucket || !options.region) throw new Error('Bucket and region are required');
    let endpoint: string | undefined;
    if (options.endpoint) {
      const url = new URL(options.endpoint);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
        throw new Error('Storage endpoint must be an HTTP(S) origin without credentials, path, or query');
      }
      endpoint = url.origin;
    }
    const prefix = (options.prefix ?? '').replace(/\/+$/, '');
    if (prefix && (prefix.includes('\\') || prefix.split('/').some(part => !part || part === '.' || part === '..') || /^[A-Za-z]:/.test(prefix))) {
      throw new Error('Invalid storage prefix');
    }
    return Object.freeze({ service: endpoint ?? `aws-s3:${options.region}`, bucket: options.bucket, prefix });
}
