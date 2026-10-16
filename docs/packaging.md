# Packaging and consumer dependency checks

The workspace uses pnpm. `pnpm test:packages` builds and packs the local packages,
then runs npm only inside an isolated temporary `simpcn-consumer-*` project to
exercise the installation experience of npm consumers. It does not install or
uninstall workspace dependencies with npm. The fixture lives outside the repo so
undeclared dependencies cannot resolve through workspace node_modules. The checks use npm's offline
cache and leave the fixture available for inspection.

The CLI bundles its S3 adapter, AWS SDK, terminal colors, and the individual
Inquirer input/select prompts. The published CLI keeps `@simpcn/core` external;
core retains jiti and its runtime files for loading TypeScript configuration.
The CLI reads its own package version so init installs the matching adapter
release rather than a hardcoded older version.
The standalone `@simpcn/storage-s3` package continues to expose its normal SDK
dependency for direct library consumers.

JavaScript transforms live in `@simpcn/transforms-js` with their parser/traversal
dependencies bundled. Next.js depends on that package. The existing
`@simpcn/transforms` API still re-exports `transformJs` and bundles its HTML/CSS
dependencies for Vite. `magic-string` stays external to preserve the public
source-map return type. The actual transform logic is unchanged.

Bundling reduces installed package directories and distribution overhead. It
does not remove the AWS SDK or parser code, and security updates still require
rebuilding and publishing the bundles. Build metadata remains local, while
third-party license texts ship with each bundle.

Checks include clean tarball installs, dependency-count limits, CLI help,
TypeScript config loading, signed S3-compatible HEAD/PUT/verification over a
local HTTP server, profile credentials, repeat-migration skipping, and packed
transform imports. Framework peers are excluded from installation counts since
the consuming application already supplies Next.js/Vite. These counts are not
the entire dependency count of a Next.js or Vite application.

Measured against the original 0.1.0 tarballs with framework peers excluded:

| Consumer install | Before | After |
| --- | ---: | ---: |
| CLI | 56 packages | 3 packages |
| CLI + Next adapter | 82 packages | 7 packages |
| CLI + both adapters | 83 packages | 9 packages |

The last scenario's installed file contents decreased from about 16.1 MB to
5.3 MB (decimal units, excluding the application/framework dependencies).
Counts include Simpcn packages themselves and depend on the resolved versions;
they are measurements of these tarballs, not a permanent package-count promise.

To run real Next.js production tests against a packed consumer instead of the
workspace adapter, set `SIMPCN_PACKED_CONSUMER` to the absolute fixture path
printed by `test:packages`, then run `pnpm --filter @simpcn/next test`.

The new `@simpcn/transforms-js` package must be published before adapters that
depend on it. Existing published packages also need a new version before
publishing these changes; local tarball checks do not change the npm release.
