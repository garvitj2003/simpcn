# Simpcn website

Official marketing site and documentation, using the existing Next.js 16.4,
React, TypeScript, and Tailwind setup. No additional UI, animation, or
markdown-rendering dependency is required.

## Local development

```sh
pnpm --dir apps/web dev
```

Use the existing dev server and hot reload while iterating. The homepage contains
the approved navbar, hero, migration illustration, problem/solution comparison,
explicit development/production example, workflow, installation, FAQ, community,
and footer. `/docs` contains eight documentation pages.

## Theme

The header toggle switches light/dark mode. Light is the default until
a manual selection is saved. The initialization script applies the choice before
the page paints; blocked local storage keeps the selection in the current tab.
All new sections use shared semantic tokens in `styles/theme.css`. Preserve the
existing Caveat display type, Geist body, pill controls, translucent materials,
and soft blue hero gradient.

## Project structure

`app/` contains route entry points, layouts, and metadata. Global foundations and
theme tokens live in `styles/`; environment configuration lives in `lib/`.
Reusable interface code lives in `components/`, grouped by purpose: `hero/`,
`home/`, `navigation/`, `motion/`, and `shared/`. Keep styles alongside the
component they describe.

Documentation is isolated in `features/docs/`: the page renderer, package-manager
selection, shared types, and documentation stylesheet. Its `content/` directory
has one module per guide plus shared examples, so a guide can be edited without
working through a single large JSX file. The files in `app/docs/` only compose
those pieces into routes. Interactive selectors remain client components;
documentation content and route rendering remain server components.

## UI stress fixtures

While the development server is running, open `/dev/ui-stress`. The development-only
page renders real shared components with Demo data, Worst case, and Empty fixtures.
It includes realistic long asset paths and configuration labels, 320px/280px
containers, and the existing theme toggle. Dataset selection stays in the URL.
The route returns 404 in production. Browser and real-device review is still needed.

## Public origin

Set `NEXT_PUBLIC_SITE_URL` to the real canonical HTTPS origin before launch.
The metadata and sitemap use that origin; no placeholder deployment domain is
hardcoded. Without it, the sitemap remains empty. See `.env.example`.

## Content boundaries

The npm package is `simpcn`, currently 0.1.0. Setup examples use the published
package and its Next.js/Vite adapters. The animation and CDN domain are
illustrative. No live upload happens in the website. Provider support and
reference limitations are documented explicitly.

Further automated verification was stopped at the user's request. Browser tools
were not used, and the website has not been deployed.
