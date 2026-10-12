# @assets-cdn/core

Read-only asset inventory and migration planning for Node.js 24+. The workspace
root is private; this package is intended to be publishable (name is provisional).

```ts
import { generateManifest, diffManifests, planMigration } from '@assets-cdn/core';

const current = await generateManifest({
  root: './public',
  exclude: ['**/.DS_Store', 'private/**'],
  concurrency: 8,
});
const previous = { version: 1 as const, assets: [] };
const actions = planMigration(diffManifests(previous, current));
```

## Stages

- `scanAssets({ root, exclude })`: sorted absolute filesystem paths and normalized
  relative keys. Includes hidden files, ignores empty directories, skips all
  symlinks (including internal links), and checks resolved paths against the root.
  Root defaults to `public`. Exclusions use Node's POSIX glob matching; matching a
  directory prunes its contents. Use `private` or `private/**` to exclude a subtree.
- `analyzeAsset(asset)`: byte size, lowercase extension (including the dot), MIME
  type, and a public URL path with each segment percent-encoded. Unknown extensions
  use `application/octet-stream`; MIME inference is not content inspection.
- `hashAsset(absolutePath)`: streaming SHA-256 hex digest. Rejects symlink files
  and detects changes during reading. `mapConcurrent` limits active operations.
- `generateManifest(options)`: combines all three stages into a version-1 manifest.
  Keys preserve relative paths. No timestamps, absolute paths, or URL encoding are
  included in storage keys. Any scan/read failure rejects the operation.
- `diffManifests(previous, current)`: added, modified, unchanged and removed assets.
  Content or delivery metadata changes count as modified. Validates manifest
  versions, records and uniqueness. Renames are represented as added plus removed.
- `planMigration(diff)`: sorted upload, replace, skip and report-removed proposals,
  each with a reason. No uploads, filesystem writes or deletions occur.

## Semantics and limits

A manifest describes local files, not remote storage. Even a skip action requires
remote verification before assuming an object exists. Removed entries never imply
permission to delete remote objects. A replacement reuses the same key and flags
cache invalidation for later provider/CDN integration. New local keys may also
already exist remotely; providers must reconcile them before executing a plan.

Run against a stable directory. Change checks catch common edits, but filesystem
walking is not an atomic snapshot or a security boundary against another process
concurrently replacing parent directories. Do not scan an adversarially mutated tree.
Literal backslashes in POSIX filenames are rejected to keep keys portable.

```sh
pnpm test
pnpm typecheck
pnpm build
```
