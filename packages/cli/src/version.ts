import { createRequire } from 'node:module';

// Both src/ and the published dist/bin.js sit one directory below package.json.
// Keep init's adapter version aligned with the CLI release, including bundles.
export const version: string = createRequire(import.meta.url)('../package.json').version;
