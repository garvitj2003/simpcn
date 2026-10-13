# v0 validation checkpoint

Packages: 0.1.0. Status: ready for controlled local testing; not published to npm.

## Environment

- Node.js 24.21.0
- pnpm 12.11.2
- npm 11.19.0
- Next.js 16.4.0 / React 19.3.0
- Vite 8.3.4

## Automated checks

```sh
pnpm test
pnpm typecheck
pnpm pack:local
git diff --check
```

Results: 98 tests passed (42 core, 5 storage adapter, 25 CLI, 10 Vite,
16 Next adapter). Two optional live-storage tests were skipped. All package
builds, type checks and diff checks passed. Packing produced all six archives:
core, storage-s3, transforms, CLI, Vite and Next.

Real Next tests compile with both Turbopack and Webpack, then start production
servers. They verify unchanged img and next/image references, a direct PNG URL,
an excluded image retaining Next optimization, SSG, request-time SSR, client
component initial output, basePath, encoding and suffixes. ISR actually
regenerates after local public files and all .simpcn build inputs are removed.
The automated asset origin is a separate local HTTP fixture, not a live CDN.

## Clean npm consumption

A fresh temporary npm project installed all six archives together, with exact
Next.js, React and Vite versions above. No workspace package links were used.

Verified:

- Installation succeeded; packed dependency manifests contained no workspace: URLs.
- CLI init generated TypeScript config, detected the existing Next adapter and
  printed manual configuration instructions. Local plan returned valid JSON.
- Vite package imported successfully.
- Next ESM and CommonJS entries both loaded, including the development helper.
- The installed production loader transformed an unchanged Image reference to
  the fixture's public URL and added unoptimized.
- Vite build, next build --turbopack and next build --webpack succeeded using the
  installed archives. The Next config was next.config.ts without type:module.
- Both generated HTML outputs contained the direct public URL rather than the
  original root-relative asset src.

The packaging smoke used matching synthetic verification records. It did not
contact a remote bucket or claim real upload verification.

## User-confirmed integration

During development, local-network MinIO migration and public reads were tested
with the user's Vite and Next test applications. The user confirmed local asset
serving during development and direct MinIO delivery of static next/image assets
after production compilation. These separate test apps are not repository apps.

## Boundaries

No browser hydration/interaction automation, standalone/serverless/Edge deployment,
live AWS S3/R2 validation, large-inventory benchmark, Next CSS integration or
automatic public bucket-policy setup is included in this checkpoint. See the root
README and adapter READMEs for supported syntax and conflict handling.
