# @simpcn/next — v0 adapter

Install from npm: `npm install -D simpcn @simpcn/next`.

The adapter supports direct public-asset delivery in production Next.js 16.4 with
Turbopack and Webpack. It supports static DOM media JSX/TSX attributes, verified
static next/image references and a compiled dynamic URL helper. The PostCSS plugin
is not implemented. Init supports Next.js detection, installation and manual
wrapper instructions.

```ts
// next.config.ts
import { withSimpcn } from '@simpcn/next';
export default withSimpcn({ /* your existing Next config */ });
```

The wrapper accepts an object or a sync/async Next config function. Its Webpack
callback stays synchronous, as required by Next, and preserves an existing user
callback. Configure publicBaseUrl explicitly in simpcn.config.ts and migrate
before production compilation. Development uses local paths.

The package exports both ESM and CommonJS entries. This supports next.config.mjs
and next.config.ts in projects without package.json type:module, where Next may
transpile the configuration's imports into require() calls.

## Exact transformation mechanism

The wrapper itself does not transform source. At production config preparation it
hashes the public inventory, validates deployment records, and serializes a public
URL map as loader options. Webpack installs dist/loader.cjs as an enforce:'pre'
JS/TS rule, on client and server configurations. Turbopack installs that same
loader through extension rules with condition:{not:'foreign'}. Options contain
ordinary JSON objects, not functions or null-prototype maps. TSX retains its
original extension; no `as:'*.js'` coercion strips its type/JSX context.

The loader uses the shared Babel parser and MagicString transform to replace
literal managed media URLs before Next's compiler. It preserves directives,
comments, source maps, unrelated strings, navigation URLs and application source
imports. It does not rewrite every slash-prefixed string. Existing configuration,
Turbopack rules, aliases, basePath and assetPrefix are retained. Complex existing
loader chains need further compatibility coverage before release.

## Deployed runtime and ISR

```tsx
import { assetUrl } from '@simpcn/next/assets';
<img src={assetUrl(`/images/${name}.svg`)} alt="Product" />
```

At build time the wrapper generates content-addressed modules in simpcn/.build/next:
the sanitized public map and a copy of the browser-only core resolver. They use
relative imports, avoiding Turbopack root escapes and pnpm transitive resolution.
Webpack uses a filesystem alias; Turbopack uses an application-relative alias.
Both bundlers compile those files into application artifacts. Original manifests,
generated source modules and storage credentials are not read by request-time
code or ISR regeneration. The production-server config phase does not rescan.
The packaged helper is an identity function in development.

The same compiled mapping is used by server and client components. URL-map changes
require another application build/deployment; uploading alone cannot update a
deployed map. Metadata URLs can explicitly call assetUrl in generateMetadata or
metadata configuration. App-directory metadata files are outside the public
inventory; there is no automatic metadata object or file rewriting.

## Public files and URL semantics

Original public/ files stay in place by default. The adapter does not delete,
exclude, move or alter them and does not change Next's public-file serving.
Generated helper sources are outside public/. URL rewriting preserves encoded
segments, query strings and fragments. basePath is used to recognize local asset
paths, not added to the CDN namespace. publicBaseUrl already includes any storage
prefix. Unknown paths remain unchanged. assetPrefix remains exclusively under
the application's existing configuration; it is not a public-asset migration tool.

## Automatic next/image handling

An unchanged `<Image src="/logo.png" width={100} height={20} alt="Logo" />`
imported from next/image becomes a verified CDN src with unoptimized during
production compilation. Scope-aware Babel traversal recognizes default imports,
aliases and named-default imports while excluding shadowed/local components.
String attributes, string expressions and templates without substitutions work.
Existing unoptimized or unoptimized={true} is retained without duplicate props.

Only static references present in the verified public map are transformed. API,
external, unknown, dynamic and StaticImageData sources remain unchanged. A static
managed image with spreads, duplicate src, loader, overrideSrc, or explicit
false/dynamic unoptimized is left unchanged with a diagnostic. Explicit global
images.unoptimized=false, custom images.loader or loaderFile is preserved unless
the element explicitly sets unoptimized=true. No remotePatterns or global image
settings are changed. These conflicting cases need manual review because direct
delivery cannot silently override an intentional optimization/loader choice.

Dynamic paths can still use `<Image src={assetUrl(path)} unoptimized ... />`.
CommonJS require bindings, namespace/member components and locally re-exported
Image wrappers are not automatically recognized. Source and public files stay
unchanged; development uses ordinary Next behavior.

## CSS/PostCSS policy before implementation

No CSS Webpack loader is installed for Turbopack: its loader bridge supports
JavaScript-returning loaders. The planned CSS integration is an optional PostCSS
plugin added to the existing plugin list; it will operate on CSS declarations
using the same verified mapping. It must not replace the application's PostCSS
config or discard Tailwind, Autoprefixer or other plugins. Creating a custom
PostCSS config can disable Next defaults, so setup must preserve the full existing
pipeline. Until this is implemented, CSS references continue to use local URLs.

## CI behavior

Production builds require matching verified records for every managed asset,
including assets available to the dynamic helper. Missing, stale, uploaded-only,
wrong-target, wrong-prefix or invalid state fails before compilation. There is no
silent local fallback and no build-time upload. Commit the matching `simpcn/deployment-state.json` with your assets, or supply a trusted deployment-state
artifact matching the current bytes, or run migration as a separate credentialed
step before the build. Missing publicBaseUrl also fails. An empty managed inventory
does not require deployment records. Local records do not prove current remote
existence, anonymous access or CDN cache freshness.

## Proof tests

production.test.ts builds real Next applications with next.config.ts, package
imports and no type:module, using both --turbopack and --webpack. An unchanged
`<img src="/images/logo.svg">` and unchanged next/image PNG references become direct URLs in
prerendered HTML and in the started production server. An independent local
asset-origin server returns the same bytes; this is a CDN-origin stand-in, not a
live provider/CDN test. The fixtures include a client component, request-rendered
App Router route, Pages Router ISR, basePath, encoding and suffixes. After build,
tests remove public files and all simpcn state, then verify SSR and actual ISR
regeneration. Config tests cover CI errors, directives, config composition and
unchanged explicit next/image settings. These tests do not yet exercise browser
hydration/interactions or a complete standalone deployment.
