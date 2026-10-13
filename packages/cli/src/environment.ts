import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseEnv } from 'node:util';

/** Shell variables win; .env.local overrides .env. Never log file contents. */
export async function loadEnvironment(directory: string, environment: NodeJS.ProcessEnv = process.env): Promise<void> {
  const values: Record<string, string> = {};
  for (const name of ['.env', '.env.local']) {
    try { Object.assign(values, parseEnv(await readFile(path.join(directory, name), 'utf8'))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  for (const [key, value] of Object.entries(values)) if (environment[key] === undefined) environment[key] = value;
}
