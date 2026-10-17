# Changelog

## 0.1.3

- Add experimental React Native with Expo image delivery: static imports and requires, iOS/Android image families, density selection, logical dimensions, and verified-state checks.
- Detect Expo during CLI setup and install the matching adapter; preserve Metro configuration and provide immutable release namespace guidance.
- Add Expo website documentation, landing-page examples, and npm/pnpm/Yarn/Bun command selectors.
- Verify packed CLI/core/Expo installation, native platform exports and warm-cache behavior in disposable consumer projects. Device, EAS and OTA validation remain outstanding.

## 0.1.2

- Keep default deployment state in `simpcn/deployment-state.json` for Git and CI; ignore generated inventory and Next.js helpers under `simpcn/.build/`. Existing explicit paths remain supported.

## 0.1.1

- Bundle the CLI's storage SDK and terminal dependencies, using only input and select prompts.
- Split JavaScript transforms from HTML/CSS tooling so Next.js installs only the transforms it uses; preserve the existing full transform exports for Vite.
- Keep the generated production asset helper bundled in installed Next.js projects, including server rendering and ISR with Webpack.
- Read the CLI release version when installing its matching framework adapter.
- Add R2 URL guidance and keep-local exclusion examples to generated configuration, plus keep-local documentation on the website.
- Include bundled third-party licenses and repeatable clean-consumer packaging checks.

Measured clean installations (excluding framework peers): CLI 56 → 3 packages,
CLI plus Next adapter 82 → 7, and CLI plus both adapters 83 → 9.
