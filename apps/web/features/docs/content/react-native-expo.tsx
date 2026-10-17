import type { Doc } from '../types';
import Link from 'next/link';
import { Code, Note } from './shared';
import { InstallCommand, PackageCommand } from '../install-command';

export const reactNativeExpo: Doc = {
  slug: 'react-native-expo', title: 'React Native with Expo',
  description: 'Experimental CDN delivery for static PNG/JPEG images, iOS and Android variants, and screen densities.',
  intro: <Note><p><strong>Experimental.</strong> Packed installation and Android/iOS exports are tested. Actual device rendering, native/EAS builds, offline/cache behavior, and OTA updates or rollback still need validation.</p></Note>,
  sections: [
    { id: 'overview', title: 'Keep your image references', body: <>
      <p>React Native normally packages local image files with the app. Simpcn can replace supported image sources with verified CDN sources during an iOS or Android production build, while leaving your application source unchanged. Development keeps Metro’s normal local image handling.</p>
      <p>This integration uses Expo’s Metro configuration. It is not support for bare React Native or Expo web. The tested fixture uses Expo 58.0.14, expo-image 58.0.15, React Native 0.88.0, and React 19.3.0.</p>
    </> },
    { id: 'static-images', title: 'Static images: imports and require()', body: <>
      <p>A static image is a local file whose path is known at build time. Both forms below are supported for PNG and JPEG images inside the managed directory:</p>
      <Code label="Your component · stays unchanged" code={"import { Image } from 'react-native';\nimport logo from './assets/cdn/logo.png';\n\n<Image source={logo} />;\n<Image source={require('./assets/cdn/logo.png')} />;"} />
      <p>Supported consumers are named imports of React Native <code>Image</code> and <code>ImageBackground</code>, and <code>Image</code> from <code>expo-image</code>. Import aliases are recognized. The build verifies each selected file and emits its CDN URL and image dimensions.</p>
      <p>An image import is removed only when all its uses have been rewritten. If the same import is used by a fallback, another consumer, or other application logic, its local asset module remains bundled. Arbitrary strings and variables containing image paths are not automatically rewritten.</p>
    </> },
    { id: 'platforms', title: 'Separate iOS and Android images', body: <>
      <p>Use different artwork on each platform without changing the component reference. Metro-style suffixes identify the platform:</p>
      <Code label="One reference, platform-specific files" code={"assets/cdn/\n  payment.png          # Generic fallback\n  payment.ios.png      # iOS artwork\n  payment.android.png  # Android artwork\n\n// Inside a component beside assets/:\n<Image source={require('./assets/cdn/payment.png')} />"} />
      <p>An iOS production build uses the iOS family’s CDN URLs; Android uses the Android family. A platform without its own family uses the generic family. Once a platform-specific family exists, its densities are selected as a group: missing densities are not filled from generic artwork.</p>
      <p><code>.native</code> families currently remain local. Keep filenames in Metro’s order when combining platform and density: <code>payment@2x.ios.png</code>.</p>
    </> },
    { id: 'densities', title: 'Sharp images with @2x and @3x', body: <>
      <p>Phones have different numbers of physical pixels in the same screen space. Density variants provide sharper copies of an image while keeping its displayed size consistent.</p>
      <div className="docs-table-wrap" tabIndex={0} role="region" aria-label="Image density and display dimensions"><table><thead><tr><th>File</th><th>Physical pixels</th><th>Logical display size</th></tr></thead><tbody><tr><td><code>logo.png</code></td><td>24 × 24</td><td>24 × 24</td></tr><tr><td><code>logo@2x.png</code></td><td>48 × 48</td><td>24 × 24</td></tr><tr><td><code>logo@3x.png</code></td><td>72 × 72</td><td>24 × 24</td></tr></tbody></table></div>
      <p>Keep using <code>require(&apos;./logo.png&apos;)</code> or the equivalent static import. A small generated helper reads React Native’s device pixel ratio and chooses the first available density at least as large as the device needs. If none is large enough, it uses the largest available. A density of 2.625 selects <code>@3x</code> when available.</p>
      <p>You supply the variant files; Simpcn does not resize images or generate <code>@2x</code>/<code>@3x</code> copies. The adapter calculates logical dimensions from pixels divided by density. Inconsistent dimensions, duplicate densities, or missing verification for a selectable sibling fail the build. Families containing only <code>@2x</code>/<code>@3x</code> files can still use the base reference.</p>
      <Code label="Platform and density together" code={"assets/cdn/\n  logo.ios.png          # 24 × 24 pixels\n  logo@2x.ios.png       # 48 × 48 pixels\n  logo.android.png      # 24 × 24 pixels\n  logo@3x.android.png   # 72 × 72 pixels"} />
    </> },
    { id: 'setup', title: 'Connect the experimental adapter', body: <>
      <InstallCommand />
      <p>Run the CLI in your Expo application directory. Init can install <code>@simpcn/expo</code> using your project’s package manager:</p>
      <PackageCommand action="init" framework="expo" />
      <p>Init detects Expo before Next.js or Vite, defaults the managed root to <code>assets/cdn</code>, and adds native release guidance. It preserves your Metro configuration and prints the wrapper instructions:</p>
      <Code label="metro.config.js · preserve existing settings and wrappers" code={"const { getDefaultConfig } = require('expo/metro-config');\nconst { withSimpcn } = require('@simpcn/expo/metro');\n\nconst config = getDefaultConfig(__dirname);\n// Keep your existing Metro configuration here.\nmodule.exports = withSimpcn(config);"} />
    </> },
    { id: 'storage', title: 'Choose a managed directory and release', body: <>
      <Code label="simpcn.config.ts · keep at the project root" code={"import type { UserConfig } from 'simpcn';\n\nexport default {\n  root: 'assets/cdn',\n  exclude: ['essential/**', 'fallback.png'],\n  stateFile: 'simpcn/deployment-state.json',\n  manifestFile: 'simpcn/.build/manifest.json',\n  storage: {\n    provider: 'r2',\n    endpoint: 'https://YOUR_ACCOUNT_ID.r2.cloudflarestorage.com',\n    bucket: 'YOUR_EXISTING_BUCKET',\n    region: 'auto',\n    prefix: 'releases/mobile-v1',\n  },\n  publicBaseUrl: 'https://YOUR_PUBLIC_HOST/releases/mobile-v1/',\n} satisfies UserConfig;"} />
      <p>Use a unique, immutable release prefix and matching public URL. Replacing bytes at a URL used by an older installed app can change that app’s images too. Keep older release namespaces available for installed builds and rollback, and use the same fixed release identifier for migration and bundling.</p>
      <p>For R2, the API endpoint is the account origin without the bucket name. The public URL includes the storage prefix once. Credentials stay in local environment files or a secret store. <Link href="/docs/storage">Storage and R2 setup →</Link></p>
    </> },
    { id: 'keep-local', title: 'Keep essential images local', body: <>
      <p>Keep app icons, splash screens, offline images, and essential fallbacks outside the managed root or add exclusions relative to it. Excluded images retain their local sources. If any selectable density sibling is excluded, that selected family stays local.</p>
      <p>CDN images may be unavailable on first launch without a network connection. This adapter does not add automatic fallback or guaranteed offline caching. Fonts, audio/video, SVG components, placeholders, and asset-preloading calls are outside the automatic image transform.</p>
    </> },
    { id: 'build', title: 'Migrate, then export', body: <>
      <PackageCommand action="workflow" framework="expo" />
      <p>Commit the deployment state with matching assets, config, source, and lockfile. Production compilation checks local verification records and does not upload files or require storage credentials. Generated workers and the mobile density helper live under ignored <code>simpcn/.build/expo/</code>.</p>
      <p>Changed images must be migrated again. Restart Metro after changing assets, state, or configuration; fresh export processes invalidate existing Simpcn caches without requiring a cache clear. Live dev-server invalidation has not been established.</p>
    </> },
    { id: 'limits', title: 'What has been verified', body: <>
      <p>Tests cover binding-aware transforms, import retention, logical dimensions, platform precedence, density selection, exclusions, stale siblings, and packed package installation. Real Android/iOS exports contain the expected CDN sources and omit transformed images from the asset graph; mixed-use and excluded assets remain bundled.</p>
      <p>These export checks do not establish actual device rendering, downloads, caching, native/EAS release behavior, or OTA update/rollback safety. Namespace component imports, custom wrappers, dynamic requires, duplicate source props, and ambiguous spread props remain outside automatic rewriting. Expo web and bare React Native need separate integrations and validation.</p>
      <p><Link href="/docs/supported-references#expo">Native reference support →</Link> · <Link href="/docs/limitations#expo">Release limitations →</Link></p>
    </> },
  ],
};
