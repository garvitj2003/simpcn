import { build } from 'tsup';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Core's filesystem/config loader stays external. It needs jiti's own runtime
// files; mobile/browser helpers never import this build script or these tools.
const bundles = {
  cli: { bin: 'src/bin.ts' },
  'transforms-js': { index: 'src/index.ts', attributes: 'src/attributes.ts' },
  transforms: { index: 'src/index.ts' },
};
const entry = bundles[process.argv[2]];
if (!entry) throw new Error('Choose cli, transforms-js or transforms');

await build({
  entry, format: ['esm'], platform: 'node', target: 'node24',
  splitting: false, clean: false, shims: true, metafile: true,
  banner: { js: 'import { createRequire as __simpcnCreateRequire } from "node:module"; const require = __simpcnCreateRequire(import.meta.url);' },
  external: ['@simpcn/core', '@simpcn/transforms-js', 'magic-string'],
  noExternal: [/^(?!@simpcn\/core(?:\/|$)|@simpcn\/transforms-js(?:\/|$)|magic-string$).*/],
  esbuildOptions(options) { options.legalComments = 'eof'; },
  esbuildPlugins: [{
    name: 'third-party-notices',
    setup(builder) {
      builder.onEnd(async result => {
        if (result.errors.length || !result.metafile) return;
        const packages = new Map();
        for (const input of Object.keys(result.metafile.inputs)) {
          if (!input.includes('node_modules/')) continue;
          let directory = path.dirname(path.resolve(input));
          while (directory !== path.dirname(directory)) {
            try {
              const pkg = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
              if (pkg.name && pkg.version) {
                packages.set(`${pkg.name}@${pkg.version}`, { directory, pkg });
                break;
              }
              directory = path.dirname(directory);
            } catch (error) {
              if (error.code !== 'ENOENT') throw error;
              directory = path.dirname(directory);
            }
          }
        }
        const notices = [];
        for (const [name, { directory, pkg }] of [...packages].sort(([a], [b]) => a.localeCompare(b))) {
          const files = (await readdir(directory)).filter(name => /^(license|licence|notice)([._-]|$)/i.test(name));
          let license = '';
          if (!files.some(name => /^licen[cs]e/i.test(name))) {
            // Some AWS packages publish only dist-* files and omit their shared
            // Apache license. Include its full text rather than omit attribution.
            if (pkg.license !== 'Apache-2.0') throw new Error(`Missing license text for bundled dependency ${name}`);
            license = await readFile(fileURLToPath(new URL('./licenses/Apache-2.0.txt', import.meta.url)), 'utf8');
          }
          notices.push(`${name} (${pkg.license ?? 'see license'})\n${license}${(await Promise.all(files.sort().map(name => readFile(path.join(directory, name), 'utf8')))).join('\n')}`);
        }
        await writeFile('dist/THIRD_PARTY_NOTICES.txt', notices.join('\n\n--------------------\n\n') + '\n');
      });
    },
  }],
});
