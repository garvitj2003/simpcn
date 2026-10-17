import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import type { DeliveryOptions } from './map.js';

/** Compile input only. Next bundles both files into client/server artifacts; runtime never reads state. */
export async function generateRuntime(cwd: string, options: DeliveryOptions): Promise<string> {
  const directory = path.join(cwd, 'simpcn', '.build', 'next');
  const runtime = await readFile(fileURLToPath(import.meta.resolve('@simpcn/core/delivery')), 'utf8');
  const digest = (source: string) => createHash('sha256').update(source).digest('hex').slice(0, 16);
  const runtimeName = `delivery-${digest(runtime)}.mjs`;
  const source = `import { createUrlMapper } from './${runtimeName}';\nexport const assetUrl = createUrlMapper({urls:JSON.parse(${JSON.stringify(JSON.stringify(options.urls))}),basePath:${JSON.stringify(options.basePath)}});\n`;
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, runtimeName), runtime);
  const filename = path.join(directory, `assets-${digest(source)}.mjs`);
  await writeFile(filename, source);
  return filename;
}
