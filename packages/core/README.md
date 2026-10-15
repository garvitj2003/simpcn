# @simpcn/core

Read-only asset inventory and migration planning for Node.js 24+. The workspace
root is private; `@simpcn/core` is published as a dependency of Simpcn.

Shared configuration loading is exported from core so the CLI and framework
integrations apply the same defaults and path rules. `publicBaseUrl` is optional for
storage operations and required for delivery integrations. It names the public
namespace root, including any storage prefix; the resolver appends only the asset key.

`loadAssetUrlResolver` reads a fresh manifest and deployment history without network
calls or writes. Managed references with missing/stale verification fail resolution.
The browser-safe `@simpcn/core/delivery` subpath exports URL mapping and srcset
handling without filesystem code or provider SDKs. Unknown/unmanaged references are
preserved. Remote availability and public access are checked separately.

```ts
import { generateManifest, diffManifests, planMigration } from '@simpcn/core';

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
- `executeMigration(plan, options)`: remote reconciliation, bounded concurrent
  uploads, transient retries with fresh streams, metadata verification, and
  per-asset results. Explicit `overwrite: true` is needed for remote conflicts.
- `LocalDeploymentStateStore(filename)`: exclusive local state sessions, serialized
  atomic writes, and upload/verification history scoped to endpoint, bucket and
  prefix. The default file is `.simpcn/deployment-state.json`.
- `MemoryStorageAdapter`: in-memory adapter for testing without credentials.
- `prepareMigration(options)`: read-only project scan and comparison with a scoped
  local manifest baseline. No files are written.
- `checkRemotePlan(plan, options)`: read-only HEAD reconciliation with bounded
  concurrency and transient retries, returning upload/replace/skip/conflict decisions.
- `migrateProject(options)`: locks the project baseline, prepares and executes the
  migration, and atomically advances the local baseline only after complete success.
  Deployment history persists independently during partial failures.

Scanning and hashing accept `AbortSignal`. The executor's `onResult` observer reports
each completed asset; observers must not throw. Project baseline envelopes record
their root and storage target around the deterministic asset manifest, preventing
accidental comparisons across unrelated deployments.

## Storage contract

`StorageAdapter` supplies `target`, `head(key, signal)` and `upload(input)`.
The target identifies service, bucket and prefix without credentials. The executor
adds the prefix to manifest storage keys. `head` must not treat authorization or
network errors as absence. `upload` consumes `openBody()` afresh per attempt and
honors create-only or ETag-conditional writes. Throw `StorageError` with a typed
code; only `transient` errors are automatically retried.

The executor checks every nonremoved object, including proposed skips. A successful
upload is persisted as `uploaded` before HEAD verification changes it to `verified`.
Verification compares size, MIME, cache policy and supplied SHA-256 metadata, not
downloaded bytes. State records describe historical observations, not a guaranteed
snapshot of remote storage. Failed verification can be resumed without reuploading
when the next HEAD matches. State-write errors make the run unsuccessful.

Removed assets retain deployment history and remote objects. No deletion operation
exists on this interface. Concurrency defaults to 4, attempts per operation to 3,
and cache policy to `public, max-age=0, must-revalidate`. `AbortSignal` supports
cancellation; work already accepted by storage may still have committed.

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
