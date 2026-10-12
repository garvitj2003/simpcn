import { comparePaths } from './scanner.js';
import type { AssetDiff, MigrationAction } from './types.js';

/** Proposals describe local differences, never verified remote state. */
export function planMigration(diff: AssetDiff): MigrationAction[] {
  return [
    ...diff.added.map(asset => ({ type: 'upload' as const, asset,
      reason: 'New local asset; remote presence has not been verified.', cacheInvalidationRequired: false })),
    ...diff.modified.map(({ current: asset }) => ({ type: 'replace' as const, asset,
      reason: 'Local content or metadata changed at the same key; review CDN cache invalidation before replacement.',
      cacheInvalidationRequired: true })),
    ...diff.unchanged.map(asset => ({ type: 'skip' as const, asset,
      reason: 'Unchanged from the previous local manifest; remote presence has not been verified.', cacheInvalidationRequired: false })),
    ...diff.removed.map(asset => ({ type: 'report-removed' as const, asset,
      reason: 'Absent locally; this does not authorize remote deletion.', cacheInvalidationRequired: false })),
  ].sort((a, b) => comparePaths(a.asset.relativePath, b.asset.relativePath));
}
