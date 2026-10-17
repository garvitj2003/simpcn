# simpcn — v0 MVP

Move frontend `public/` assets to CDN-backed object storage without manually
rewriting supported static references. Simpcn scans and fingerprints files,
plans changes, uploads and verifies assets, and rewrites production references
through Vite or Next.js. Development continues to use local public assets.

**This checkout prepares Simpcn 0.1.1.** Requires Node.js 24.11+ for the
framework integrations.

## Install from npm

From an existing Next.js or Vite application's directory:

```sh
npm install -D simpcn
npx simpcn init
```

Init detects the framework and can install its adapter. Add the printed
integration to the existing framework configuration, configure an existing
storage bucket and public delivery URL, then plan, migrate, and build.
Alternatively install the adapter explicitly:

```sh
# Next.js
npm install -D simpcn @simpcn/next

# Or Vite
npm install -D simpcn @simpcn/vite
```

The website in `apps/web` includes setup guides, compatibility details, and
supported-reference limitations at `/docs`.


## Local checkout installation (contributors)

From this repository:

```sh
pnpm install
pnpm pack:local
```

To test a local checkout instead of the npm release, install the generated archives together
(replace `/path/to/simpcn` with this checkout):

```sh
npm install -D \
  /path/to/simpcn/artifacts/simpcn-core-0.1.1.tgz \
  /path/to/simpcn/artifacts/simpcn-0.1.1.tgz
```

Add **one** framework adapter:

```sh
# Next.js
npm install -D /path/to/simpcn/artifacts/simpcn-transforms-js-0.1.1.tgz /path/to/simpcn/artifacts/simpcn-next-0.1.1.tgz

# Or Vite
npm install -D /path/to/simpcn/artifacts/simpcn-transforms-js-0.1.1.tgz /path/to/simpcn/artifacts/simpcn-transforms-0.1.1.tgz /path/to/simpcn/artifacts/simpcn-vite-0.1.1.tgz
```

Direct npm links to workspace packages can fail on `workspace:*`. Packed archives
replace those dependency ranges with package versions. Repack and reinstall
archives after library changes; they are snapshots rather than live links.

## Project setup

```sh
npx simpcn init
```

Init detects and confirms Vite, Next.js or core-only setup, asks for the storage
provider, and creates `simpcn.config.ts`. Bucket defaults to the project name;
prefix defaults to `assets`. Existing declared adapters are not reinstalled.
For local archive installation through the wizard, use `--integration-package`
with your adapter archive. Flags and `--yes` support noninteractive setup.

Fill in the commented `storage.endpoint` when using MinIO/R2, and set
`publicBaseUrl` to the public delivery root including any asset prefix. That URL
is never auto-derived. Buckets must already exist; configure anonymous reads or
CDN-to-origin access separately.

Copy `.env.example` to `.env.local` and enter credentials:

```dotenv
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
```

The CLI automatically loads `.env` and `.env.local` beside the discovered config;
shell variables take precedence. Init adds these files, `simpcn/.build/`, and temporary state locks/files to
`.gitignore`. Keep credentials out of `VITE_` and `NEXT_PUBLIC_` variables.

## Framework configuration

Init prints instructions and leaves framework configuration files untouched.

```ts
// next.config.ts
import { withSimpcn } from '@simpcn/next';
export default withSimpcn({ /* existing Next settings */ });
```

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { simpcn } from '@simpcn/vite';
export default defineConfig({ plugins: [simpcn(), react()] });
```

See [Next.js details](packages/next/README.md),
[Vite details](packages/vite/README.md), and [CLI options](packages/cli/README.md).

## Migration and production

```sh
npx simpcn plan
npx simpcn plan --check-remote
npx simpcn migrate
npm run build
```

Only `migrate` uploads. Different remote content requires an explicit
`migrate --overwrite`. Removed local files are reported rather than deleted
remotely. Successful progress survives partial failure. Framework builds read
fresh local bytes and verified deployment state without contacting storage.
They fail for missing public URLs or stale/missing managed asset verification.

The default `simpcn/.build/manifest.json` is the last complete local migration baseline;
`simpcn/deployment-state.json` records uploads and verification separately.
Commit the deployment state with your config and matching source/public assets after migration.
A fresh CI checkout can then build without storage credentials or a migration step.
Init creates or updates `.gitignore` to keep `simpcn/.build/` local.
Existing explicit paths remain supported; to adopt this layout, update `stateFile`
and `manifestFile`, move the existing state, and ensure Git tracks its new location. A local record does not prove current anonymous
access or CDN freshness. Source and public files stay in place.

## v0 scope

- MinIO uploads and browser delivery have been tested on a local network. AWS S3
  and R2 use the S3-compatible adapter but have not been live-validated.
- Vite 8 handles supported HTML, JSX/TSX and bundled CSS references. Vue/Svelte
  template syntax is not automatically transformed.
- Next.js 16.4 supports Turbopack and Webpack, supported intrinsic media JSX,
  verified static `next/image` references, and the `assetUrl()` helper. Ordinary
  managed Image references get a direct URL and `unoptimized` at build time.
  Explicit conflicting settings, custom loaders and ambiguous spreads are
  preserved with diagnostics.
- Dynamic paths require the helper. Database/API URLs and unknown paths are not
  inferred as assets. Next CSS, `next/font`, metadata conventions and raw public
  file contents are not automatically rewritten.
- Public access setup, CDN cache purging, multipart uploads, remote deletion,
  hosted CI state persistence and CRA integration are outside v0.
- Real Next tests cover SSG, SSR, client-component initial output and ISR after
  local state removal. Browser hydration, standalone, Edge and serverless
  deployments have not been validated. There is no large-project benchmark yet.

## Repository and checks

Packages: `simpcn`, `@simpcn/core`, `@simpcn/storage-s3`, `@simpcn/transforms`,
`@simpcn/transforms-js`, `@simpcn/vite`, and `@simpcn/next`. `apps/web` is the Next.js launch website.
`examples/minio.mjs` is the direct-library example with its own baseline file.

```sh
pnpm test
pnpm typecheck
pnpm pack:local
```

The default tests use local fixtures and production test servers, with no external
storage access. The opt-in MinIO tests write to dedicated test prefixes and leave
remote objects for inspection:

```sh
SIMPCN_MINIO_TEST=1 pnpm test:minio
SIMPCN_MINIO_TEST=1 pnpm test:cli:minio
```

For dependency bundling, clean consumer installs, and package verification, see
[packaging checks](docs/packaging.md). Run `pnpm test:packages` after packaging changes.
