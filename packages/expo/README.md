# @simpcn/expo — experimental image adapter

Experimental Expo integration. Actual device rendering, native/EAS builds and OTA behavior still require validation.
No Expo application is maintained in this repository. Real export tests create a disposable project outside the workspace.

This adapter uses the documented Expo Babel-transformer extension, delegating to the configured upstream transformer in the same Babel pass. It removes supported image requires before Metro extracts dependencies and keeps source locations in the existing compilation pipeline.

```js
// metro.config.js — experimental local testing only
const { getDefaultConfig } = require('expo/metro-config');
const { withSimpcn } = require('@simpcn/expo/metro');
module.exports = withSimpcn(getDefaultConfig(__dirname));
```

Use a dedicated managed root such as `assets/cdn` in the root `simpcn.config.ts`.
The existing core CLI can plan and migrate that directory. Use a unique release prefix and a matching publicBaseUrl, migrate before bundling, and commit the deployment state with the matching assets. Never reuse an older app release's namespace for changed bytes; retain old namespaces for installed apps and rollback.

## Current boundary

- iOS/Android production only, using Metro's `dev` and `platform` flags. Development and web compilation delegate unchanged.
- Direct literal relative `require()` expressions and default image imports in `source` on named imports of React Native `Image`, `ImageBackground`, and `expo-image` `Image`. Aliases and shadowing are checked through Babel bindings. An import is removed only when every use has been rewritten; unrelated uses retain the local asset module.
- PNG/JPEG families support generic, `.ios` and `.android` files plus density variants such as `@2x` and `@3x`. Use Metro naming order: `icon@2x.ios.png`. A platform-specific family takes precedence as a whole; missing densities are not filled from the generic family. Families without a base file are supported. All selectable siblings must pass core verification before compilation succeeds. No network or upload credentials are used during compilation.
- Logical dimensions are physical pixels divided by density: a 48px `@2x` image has width 24. Inconsistent dimensions or duplicate densities fail the build. A small generated mobile helper uses `PixelRatio.get()` to choose the first density at least as large as the device density, falling back to the largest available. Single-density families use a literal source object without the helper.
- Exclusions and files outside the managed inventory remain local. If a selected family contains an excluded sibling, that family stays local. `.native` families remain under Metro control pending separate resolution tests.
- Namespace imports, named image exports, shadowed components/require, spreads, duplicate source props, dynamic expressions, wrappers, defaultSource, fonts, audio/video, SVG, app icons, splash screens, and asset preloading are not automatically rewritten.
- A require used elsewhere still retains its asset in the bundle.

The Metro configuration writes a content-addressed transformer snapshot under `simpcn/.build/expo/`, already covered by init's ignore rule. Worker processes receive configuration through that generated module, without mutable process globals. The snapshot/cache namespace includes asset hashes, state, configuration, and adapter implementation. Restart Metro after changing these inputs; fresh export processes invalidate existing caches without `--clear`. Live dev-server invalidation is not established.

## Verification

```sh
pnpm --filter @simpcn/expo test
pnpm test:expo
```

The verification command packs core, CLI and the Expo adapter into `artifacts/expo/`. The export script installs those exact tarballs, runs packed CLI init with the local adapter archive, loads the CommonJS Metro export, and verifies package contents before exporting. It uses pnpm in a temporary directory and removes it, including installed test dependencies, on completion or failure. It runs Android/iOS exports, examines static-import removal and variant sources in the asset graph, checks retained mixed-use/excluded assets, exercises a warm-cache URL change, and rejects stale asset bytes. `SIMPCN_KEEP_EXPO_FIXTURE=1` is an explicit debugging escape hatch; retained fixtures must be removed afterward.

Pinned fixture: Expo 58.0.14, expo-image 58.0.15, React Native 0.88.0, React 19.3.0. These are export tests; actual iOS/Android execution, layout, image downloads, device density behavior, offline failure behavior, EAS/native build and OTA rollback validation remain required before release. The generated mobile helper imports only React Native; core, filesystem utilities, storage SDKs and credentials remain build-only.

CDN images require network availability on first use. Exclusions keep essential images bundled; this prototype does not add automatic fallback or durable offline caching.

## Examples

```tsx
import { Image } from 'react-native';
import logo from './assets/cdn/logo.png';

// Both use the same verified platform/density family in production.
<Image source={logo} />;
<Image source={require('./assets/cdn/logo.png')} />;
```

```text
assets/cdn/
  logo.png             # 24×24 pixels, fallback
  logo@2x.png          # 48×48 pixels, fallback
  logo.ios.png         # 24×24 pixels, iOS family
  logo@2x.ios.png       # 48×48 pixels, iOS family
  logo.android.png     # 24×24 pixels, Android family
  logo@3x.android.png   # 72×72 pixels, Android family
```

An iOS device with density 3 receives the largest available iOS image (`logo@2x.ios.png`), with logical dimensions 24×24. Android selects from its own family. Files stay bundled in development.


## CLI onboarding

The CLI detects Expo and offers `--framework expo` in the wizard. Defaults
are `assets/cdn` and `releases/v1`; change the prefix for each immutable release.
Generated config includes native release guidance and retains provider-specific R2
URL instructions. Init creates/updates Git ignore rules but preserves Metro config.

Init installs the matching `@simpcn/expo` release using the project package manager,
or uses an already installed adapter. Local development checks can override the
registry package with `--integration-package /path/to/adapter.tgz`. Use packed
CLI/core/adapter archives together when testing local development changes.
