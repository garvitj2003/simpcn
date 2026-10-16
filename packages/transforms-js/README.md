# @simpcn/transforms-js

Build-time JavaScript/JSX asset rewriting, including the scoped Next.js Image
transform. Used by `@simpcn/next` and re-exported by `@simpcn/transforms` for Vite.
Requires Node.js 24.11+.

Parser and traversal dependencies are bundled at publish time. HTML/CSS tools
are kept in the separate `@simpcn/transforms` package, so Next.js consumers do
not install or download them. `magic-string` stays external because the public
transform result and declarations expose its source-map type. Core stays
external to share the delivery types and configuration runtime.

Bundle license texts are included in `dist/THIRD_PARTY_NOTICES.txt`. This package
is build tooling; it is not a browser runtime helper.
