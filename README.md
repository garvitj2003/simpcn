# simpcn

A framework-agnostic foundation for moving frontend public assets to CDN-backed
object storage. The local MVP discovers and fingerprints assets, plans changes,
and uploads through an S3-compatible storage adapter. Framework URL integration
and CDN delivery are future work.

## Packages

- `@simpcn/core`: scanner, analyzer, hasher, deterministic manifest generator,
  diff engine, dry-run planner, migration executor and local deployment state.
- `@simpcn/storage-s3`: streamed S3-compatible uploads and remote metadata
  checks, including a MinIO configuration factory.
- `simpcn`: the `simpcn` executable with init, plan and migrate commands.
- `@simpcn/vite`: production URL rewriting for Vite 8 projects, with shared
  delivery resolution and local development behavior. See its package README.
- `apps/web`: frontend scaffold and sample public assets.

Requires Node.js 24+ and the repository's pinned pnpm version.
The Vite package requires Node.js 24.11+ because of its parser dependencies.

## Vite integration

Add `publicBaseUrl` to `simpcn.config.ts`, naming the public root of the uploaded
namespace (including a storage prefix when needed). Add `simpcn()` from
`@simpcn/vite` before framework plugins in `vite.config.ts`, then migrate and
build. Supported static HTML/JSX/CSS references become direct delivery URLs in
production; local development references remain local. Builds check fresh hashes
against deployment history without uploading or making storage requests.

The workspace's intended MinIO delivery base is
`http://192.168.1.14:9000/simpcn-test/mvp/`. Anonymous reads are enabled for `simpcn-test/mvp/*`, and the five sample
assets have been verified to download successfully over the local network.
Storage permissions are not changed by the plugin. The plugin and its support
boundaries are documented in [`packages/vite/README.md`](packages/vite/README.md).

```sh
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

## Local MinIO migration

The main entry point is now the CLI, configured by `simpcn.config.ts`:

```sh
pnpm build
pnpm simpcn plan
pnpm simpcn plan --check-remote
pnpm simpcn migrate
```

The root script loads `.env.local`. Configurable asset roots, exclusions, upload
settings, structured JSON output and initialization are documented in
[`packages/cli/README.md`](packages/cli/README.md). To deliberately replace differing
remote objects, use `pnpm simpcn migrate --overwrite`.

The new local baseline is `.simpcn/manifest.json`; deployment history remains in
`.simpcn/minio-state.json`. The baseline contains a versioned envelope scoped to the
asset root and destination. CLI progress uses stderr; `--json` disables progress.

### Library example

The original `examples/minio.mjs` remains available as a library usage example. It
uses its own legacy local baseline alongside the same deployment history:

Copy `.env.example` to `.env.local` and set credentials there or in your shell.
The local file is ignored by Git. Defaults target the MinIO S3 API at
`http://192.168.1.14:9000`, existing bucket `simpcn-test`, region `us-east-1`, and
prefix `mvp`. The bucket must already exist.

```sh
pnpm minio:plan
pnpm minio:migrate
```

The plan command is local-only: no storage requests, state writes, or uploads.
Migration checks each remote object, uploads missing assets, and verifies metadata.
It skips matching objects even if the local plan proposes an upload. It restores
missing objects even if the local plan proposes a skip.

Existing objects with different or missing SHA-256 metadata are conflicts by
default. To deliberately replace them in the configured test prefix:

```sh
pnpm minio:migrate --overwrite
```

Creates/replacements use conditional PUTs to avoid racing another writer.
Replacements report `replaced: true`; CDN purging is not performed. Removed local
assets are reported and their remote objects remain intact.

## Local state and recovery

- `.simpcn/minio-state.json`: successful upload and metadata-verification history,
  scoped to service endpoint, bucket and prefix.
- `.simpcn/minio-state.json.manifest.json`: complete last successful local inventory.
  This is the library example's baseline; the CLI uses `.simpcn/manifest.json`.
- Both are gitignored. State is atomically replaced after each successful upload
  and verification, so partial successes survive a failed run.
- State locks prevent concurrent local writes. After a process crash, remove a
  stale lock only after confirming that its migration process is no longer running.
- Rerun the same command after a failure. Every asset is reconciled remotely;
  state history is not proof that the object still exists.

The executor defaults to four concurrent assets and three total attempts per
network operation, retrying transient errors with capped exponential delay.
Independent assets finish when another asset fails. The command exits nonzero on
failure or cancellation. Report `attempts` counts all network calls for that asset,
not just uploads (normally HEAD + PUT + HEAD = 3).

Verification checks HEAD metadata: size, MIME, cache policy and our SHA-256 field.
It does not download and cryptographically validate the stored bytes. The opt-in
integration test additionally downloads objects to validate their actual hashes.

```sh
SIMPCN_MINIO_TEST=1 pnpm test:minio
```

This test writes three objects under `<S3_PREFIX>/integration`, deliberately
replaces its `changed.txt` object, and leaves remote objects available for inspection.
Regular `pnpm test` requires no credentials and does not access the network.

The MVP uses streaming single-part uploads, supporting files up to 5 GiB. Multipart
uploads, CI state persistence, deletion policies, framework adapters, public CDN
URLs and cache invalidation are not implemented yet. Run against a stable asset
directory; filesystem reads are not an atomic snapshot.
