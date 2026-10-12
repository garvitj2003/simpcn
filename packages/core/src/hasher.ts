import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';

/** Streams bytes; rejects files that change while hashing. */
export async function hashAsset(absolutePath: string): Promise<string> {
  const file = await open(absolutePath, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = await file.stat({ bigint: true });
    if (!before.isFile()) throw new Error(`Not a regular file: ${absolutePath}`);
    const hash = createHash('sha256');
    for await (const chunk of file.createReadStream({ autoClose: false })) hash.update(chunk);
    const after = await file.stat({ bigint: true });
    if (before.size !== after.size || before.mtimeNs !== after.mtimeNs || before.ctimeNs !== after.ctimeNs) {
      throw new Error(`Asset changed while hashing: ${absolutePath}`);
    }
    return hash.digest('hex');
  } finally {
    await file.close();
  }
}

export async function mapConcurrent<T, R>(items: readonly T[], concurrency: number,
  operation: (item: T) => Promise<R>): Promise<R[]> {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) throw new Error('Concurrency must be a positive integer');
  const results: R[] = new Array(items.length);
  let cursor = 0;
  let failed = false;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (!failed && cursor < items.length) {
      const index = cursor++;
      try { results[index] = await operation(items[index]); }
      catch (error) { failed = true; throw error; }
    }
  });
  const settled = await Promise.allSettled(workers);
  for (const result of settled) if (result.status === 'rejected') throw result.reason;
  return results;
}
