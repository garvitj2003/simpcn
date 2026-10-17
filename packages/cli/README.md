# simpcn

CLI for scanning, planning and migrating public assets. Requires Node.js 24+.
The framework integrations require Node.js 24.11+.

## Setup

```sh
npm install -D simpcn
npx simpcn init
```

Interactive init uses arrow-key menus (Enter to select) for the framework and
storage provider, with colored headings and completion messages. It asks for
region, bucket and prefix, then creates `simpcn.config.ts`. Vite selection installs
`@simpcn/vite`; Next.js selection installs `@simpcn/next` with the project's package
manager if it is not already declared. Next.js projects are detected through the
`next` dependency and preselected in the menu. Init never edits framework config
files: it prints Vite plugin or Next.js `withSimpcn()` wrapper instructions.
The Next adapter supports automatic verified static `next/image` references.
CSS rewriting is not implemented.

The bucket defaults to a normalized package.json project name (directory name as
fallback). The prefix defaults to `assets`. Both are editable. The bucket must
already exist: initialization does not create buckets or change access policies.
An existing configuration requires `--force` to replace.

```sh
npx simpcn init --yes --framework vite --provider minio --endpoint http://localhost:9000 --bucket test-cn --prefix assets
```

Use `--skip-install` to install the integration yourself. For local checkout
testing, use `--integration-package /absolute/path/simpcn-vite-0.1.1.tgz`, or
`simpcn-next-0.1.1.tgz` with `--framework next`. Install matching local core and
transforms archives in the consuming project as well.
`--json` and noninteractive terminals suppress prompts; flags override defaults.
If dependency installation fails, generated settings are retained and the CLI
reports the failure. Install the integration manually; there is no need to erase
or regenerate the storage configuration.

## Configuration and credentials

Only TypeScript configuration is supported. Discovery walks up from the working
directory; `--config` selects an explicit `.ts` file. Config paths are relative to
that file; command-line path overrides are relative to the working directory.

```ts
import type { UserConfig } from 'simpcn';

export default {
  root: 'public',
  storage: {
    provider: 'minio',
    // Storage API origin for uploads, not the public CDN URL.
    endpoint: 'http://localhost:9000',
    bucket: 'test-cn',
    prefix: 'assets',
  },
  // Required for production Vite builds. Include the delivery prefix.
  // publicBaseUrl: 'https://cdn.example.com/assets/',
} satisfies UserConfig;
```

`publicBaseUrl` is never derived. Local planning and uploads work without it;
production builds with the plugin require it. Config is executable TypeScript
and should be trusted project code. Runtime validation rejects unknown fields and
invalid settings. Obvious AWS/R2 endpoint-provider mismatches are rejected; custom
endpoints cannot reliably identify their storage provider.

Init creates `.env.example` if missing and adds `.env`, `.env.local`, `simpcn/.build/`, and temporary state locks/files
to `.gitignore`. Put credentials in `.env.local`:

```dotenv
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
# AWS_SESSION_TOKEN=optional-session-token
```

The CLI loads `.env` then `.env.local` beside the discovered configuration before
loading config or creating the storage adapter. Existing shell variables take
precedence. No credentials are printed or written into config. Never use `VITE_`
prefixes for secrets. Standard AWS credential-chain sources also remain supported.

```sh
npx simpcn plan
npx simpcn plan --check-remote
npx simpcn migrate
npx simpcn migrate --overwrite
```

A local plan never contacts storage. Remote checks use HEAD without uploads.
Migration verifies remote state and preserves successful progress on partial
failure. Replacement requires `--overwrite`; removed local files are reported,
never deleted remotely. Review caches after replacing existing keys.

Human output uses compact, colored summaries with readable transfer sizes.
Unchanged files are counted once instead of printed individually; conflicts and
failures retain their per-file explanations. Remote plans display one action list
from the remote check. Colors follow terminal support and `NO_COLOR`.

Use `--json` for structured stdout. Exit codes: 0 success, 1 execution failure,
2 usage/configuration error, 130 cancellation. Run `simpcn --help` for all flags.

Init does not prompt for endpoint or public asset URLs. Edit the commented
`storage.endpoint` and `publicBaseUrl` fields in the generated config. MinIO/R2
require an endpoint before planning or migration; production builds require the
public URL. Explicit URL flags remain available for scripted setup. Ctrl+C
cancels prompts with exit code 130. `NO_COLOR=1` disables colors.

The published CLI bundles the storage SDK and terminal dependencies. Only the
input and selection prompt packages are used. Core and its TypeScript config
loader remain external. Bundled dependency licenses are included in
`dist/THIRD_PARTY_NOTICES.txt`; updating bundled dependencies requires a new build
and release. Workspace development continues to use pnpm.

Commit `simpcn/deployment-state.json` after migration with the matching assets and
root `simpcn.config.ts`. CI builds use this verification record without storage credentials.
The local manifest defaults to `simpcn/.build/manifest.json`. Existing explicit paths remain supported.
