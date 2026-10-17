export const packageManagers = {
  npm: { add: 'npm i -D', exec: 'npx', build: 'npm run build' },
  pnpm: { add: 'pnpm add -D', exec: 'pnpm exec', build: 'pnpm run build' },
  bun: { add: 'bun add -d', exec: 'bun run', build: 'bun run build' },
  yarn: { add: 'yarn add -D', exec: 'yarn run', build: 'yarn run build' },
} as const;
export type PackageManager = keyof typeof packageManagers;
export type Framework = 'next' | 'vite' | 'expo';

export function initCommand(manager: PackageManager, framework?: Framework, integrationPackage?: string) {
  return `${packageManagers[manager].exec} simpcn init${framework ? ` --framework ${framework}` : ''}${integrationPackage ? ` \\\n  --integration-package ${integrationPackage}` : ''}`;
}
export function workflowCommand(manager: PackageManager, framework?: Framework) {
  const runner = packageManagers[manager].exec;
  const build = framework === 'expo' ? `${runner} expo export --platform ios\n${runner} expo export --platform android` : packageManagers[manager].build;
  return `${runner} simpcn plan\n${runner} simpcn migrate\n${build}`;
}
