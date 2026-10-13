# @simpcn/vite

Build-time public asset URL integration for Vite 8. Requires Node.js 24.11+.
These packages have not been published yet; use local archives for v0 testing.

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { simpcn } from '@simpcn/vite';

export default defineConfig({
  plugins: [simpcn(), react()],
});
```

Place simpcn before plugins that compile JSX. It uses Vite's config, transform,
HTML and virtual-module hooks, plus the experimental `renderBuiltUrl` hook for
native public asset imports. Generated application chunks and imported source
assets keep Vite's normal delivery behavior.

## Testing locally from an npm project

Run `pnpm pack:local` from the simpcn repository. This builds all packages
and writes npm-compatible tarballs to `artifacts/`, replacing workspace dependency
ranges with package versions. Direct `npm link` of these workspace packages can
fail with `EUNSUPPORTEDPROTOCOL`.

From your React application's directory, install all required archives together
(replace `/path/to/simpcn` with your checkout):

```sh
npm install -D /path/to/simpcn/artifacts/simpcn-core-0.1.0.tgz /path/to/simpcn/artifacts/simpcn-storage-s3-0.1.0.tgz /path/to/simpcn/artifacts/simpcn-0.1.0.tgz /path/to/simpcn/artifacts/simpcn-transforms-0.1.0.tgz /path/to/simpcn/artifacts/simpcn-vite-0.1.0.tgz
npx simpcn --help
```

Installing the archives together supplies the unpublished dependencies locally.
Configure the plugin as above, then use `npx simpcn init`, `npx simpcn plan`, and
`npx simpcn migrate`. The CLI loads `.env` and `.env.local` beside the configuration, with shell variables taking precedence. Rebuild the archives and reinstall after library
changes; archive installs are snapshots, not live links.

## Configuration

The plugin discovers `simpcn.config.ts` in the Vite root or its parents.
Use `simpcn({ config: './simpcn.config.ts' })` to select it explicitly. Paths in
that configuration resolve relative to the configuration file. The configured
asset root must match Vite's `publicDir`.

```ts
export default {
  "version": 1,
  "root": "public",
  "exclude": ["**/.DS_Store"],
  "publicBaseUrl": "https://cdn.example.com/mvp/",
  "storage": {
    "provider": "minio",
    "endpoint": "http://192.168.1.14:9000",
    "bucket": "simpcn-test",
    "region": "us-east-1",
    "prefix": "mvp"
  },
  "stateFile": ".simpcn/deployment-state.json"
};
```

`publicBaseUrl` names the public root of the uploaded namespace, **including any
storage prefix or CDN path mapping**. The resolver appends only the relative asset
key. For path-style MinIO without a CDN, the equivalent is
`http://192.168.1.14:9000/simpcn-test/mvp/`. Storage credentials do not make that URL
public: anonymous read access or a publicly accessible CDN origin is required.
The plugin never changes bucket permissions.

Configure the delivery URL during CLI initialization with `--public-base-url` or
edit the TypeScript field. Upload with `simpcn migrate`, then run `vite build`. Builds
read local files and deployment state without credentials, network calls or uploads.
Referenced managed assets must have matching verified hashes, sizes, MIME types,
keys and cache policies. Missing/stale records fail the build with an asset path.
Historical verification is not proof of current remote availability.

## Supported references

- Static HTML and JSX/TSX `src` on img/source/video/audio/track/input/embed.
- Image/source `srcSet`, video `poster`, object `data`, SVG image href.
- Icon and preload link URLs; ordinary anchor/navigation URLs are untouched.
- Bundled CSS `url()` declarations, including fonts and backgrounds; HTML inline
  styles and style blocks. Source maps are preserved for JS and CSS transforms.
- Native public-file URL imports handled by Vite.
- Managed root-relative `?url` imports, including filenames with percent-encoded
  spaces, `#`, `?` and `%`. Only the bare `url` directive is removed; resource
  query parameters and fragments are preserved. Competing raw/inline/worker
  directives and unmanaged imports retain Vite's own handling.
- Root-relative URLs, including an application base path; query strings and
  fragments are retained and filename segments are encoded.

External URLs, data URLs, excluded assets, comments and unrelated JavaScript strings
are untouched. Only managed assets are redirected. Vite may still copy public files
to the output; the plugin does not remove local originals or copied fallback assets.

In development, references remain local and no configuration or deployment state
is required by the plugin.

## Dynamic URLs

```tsx
import { assetUrl } from 'virtual:simpcn';

<img src={assetUrl(`/products/${id}.png`)} />
```

The helper looks up known asset paths, retaining suffixes and leaving unknown paths
unchanged. Development uses an identity function. Production includes only public
URL mappings and resolver code, with no provider SDK, credentials or deployment
history. Importing the helper requires **all managed assets** to be verified because
their possible runtime usage cannot be determined at build time.

Add `@simpcn/vite/client` to TypeScript's `compilerOptions.types` (alongside
`vite/client`) for the virtual module declaration.

Dynamic JSX attributes without the helper generate a diagnostic and stay unchanged.
Custom component props, strings loaded from APIs/JSON, Vue/Svelte templates, inline
JS style strings and arbitrary runtime concatenation are not automatically rewritten.

Use bundled source CSS for transformation. Public stylesheets/scripts uploaded as
raw objects retain their contents, so references inside them are not rewritten by
the plugin. Relative references inside such files need to remain valid under the
public namespace. CDN font delivery also needs suitable CORS response headers.

Next.js integration is available through `@simpcn/next`; see its README for scope.
