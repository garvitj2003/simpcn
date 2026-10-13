import { parseArgs } from 'node:util';

export interface Flags {
  help?: boolean; version?: boolean; json?: boolean; overwrite?: boolean; force?: boolean;
  'check-remote'?: boolean; framework?: string; yes?: boolean; 'skip-install'?: boolean; 'integration-package'?: string;
  config?: string; root?: string; provider?: string; endpoint?: string; bucket?: string;
  region?: string; prefix?: string; 'state-file'?: string; 'manifest-file'?: string;
  concurrency?: string; 'hash-concurrency'?: string; 'max-attempts'?: string;
  'retry-delay-ms'?: string; 'cache-control'?: string; exclude?: string[];
  'public-base-url'?: string;
}
export function parseArguments(args: string[]): { command?: string; flags: Flags } {
  const { values, positionals, tokens } = parseArgs({ args, allowPositionals: true, strict: true, tokens: true, options: {
    'integration-package': { type: 'string' }, framework: { type: 'string' }, yes: { type: 'boolean', short: 'y' }, 'skip-install': { type: 'boolean' },
    help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' },
    json: { type: 'boolean' }, overwrite: { type: 'boolean' }, force: { type: 'boolean' },
    'check-remote': { type: 'boolean' }, config: { type: 'string', short: 'c' },
    root: { type: 'string' }, provider: { type: 'string' }, endpoint: { type: 'string' },
    bucket: { type: 'string' }, region: { type: 'string' }, prefix: { type: 'string' },
    'state-file': { type: 'string' }, 'manifest-file': { type: 'string' },
    concurrency: { type: 'string' }, 'hash-concurrency': { type: 'string' },
    'max-attempts': { type: 'string' }, 'retry-delay-ms': { type: 'string' },
    'cache-control': { type: 'string' }, exclude: { type: 'string', multiple: true },
    'public-base-url': { type: 'string' },
  } });
  const seen = new Set<string>();
  for (const token of tokens) {
    if (token.kind !== 'option') continue;
    if (seen.has(token.name) && token.name !== 'exclude') throw new Error(`Option --${token.name} was supplied twice`);
    seen.add(token.name);
  }
  if (positionals.length > 1) throw new Error('Only one command is accepted');
  const command = positionals[0];
  for (const [name, value] of Object.entries(values)) {
    if (typeof value === 'string' && name !== 'prefix' && !value.trim()) throw new Error(`Option --${name} cannot be empty`);
  }
  if (command && !['init', 'plan', 'migrate'].includes(command)) throw new Error(`Unknown command: ${command}`);
  if (values.force && command !== 'init') throw new Error('--force is only valid with init');
  if (values['check-remote'] && command !== 'plan') throw new Error('--check-remote is only valid with plan');
  if (values.overwrite && command !== 'migrate' && !(command === 'plan' && values['check-remote'])) {
    throw new Error('--overwrite is only valid with migrate or plan --check-remote');
  }
  if (values.framework && !['vite', 'core', 'next'].includes(values.framework)) throw new Error('framework must be vite or core (Next.js is not implemented yet)');
  if ((values.framework || values.yes || values['skip-install'] || values['integration-package']) && command !== 'init') throw new Error('Setup options are only valid with init');
  return { command, flags: values as Flags };
}

export const HELP = `Usage: simpcn <command> [options]

Commands:
  init                 Create simpcn.config.ts (--force to replace)
  plan                 Show a local dry run (--check-remote for HEAD checks)
  migrate              Reconcile, upload and verify assets (--overwrite to replace)

Options:
  --framework <name>  vite or core (Next.js support is upcoming)
  -y, --yes            Accept defaults without prompts
  --skip-install      Configure only; install integration manually
  --integration-package <path>  Local Vite .tgz archive for unpublished testing
  -c, --config <path>   Explicit TypeScript configuration
  --root <path>        Asset directory
  --provider <name>    s3, minio or r2
  --endpoint <url>     S3 API endpoint (required for minio/r2)
  --bucket <name>      Existing bucket
  --region <name>      Region (default: us-east-1; r2: auto)
  --prefix <path>      Object key prefix
  --exclude <glob>     Repeatable exclusions (replaces config exclusions)
  --state-file <path>  Local deployment history
  --manifest-file <path> Last successful local inventory
  --concurrency <n>    Concurrent assets (default: 4)
  --hash-concurrency <n> Hash workers (default: 8)
  --max-attempts <n>   Attempts per network operation (default: 3)
  --retry-delay-ms <n> Initial retry delay (default: 200)
  --cache-control <value> Delivery cache policy
  --public-base-url <url> Public root of the uploaded asset namespace
  --json               Machine-readable stdout; no progress output
  -h, --help           Show help
  -v, --version        Show version

Config paths are relative to their config directory; flag paths are relative to cwd.
Credentials use the AWS SDK chain (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY).
Exit codes: 0 success, 1 execution failure/conflicts, 2 usage/config errors, 130 cancelled.
`;
