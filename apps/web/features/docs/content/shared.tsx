import type { ReactNode } from 'react';
import { CodeBlock } from '@/components/shared/code-block';

export const storageConfig = `import type { UserConfig } from 'simpcn';

export default {
  root: 'public',
  // Keep essential assets local. Patterns are relative to root, without public/.
  // Example: ['favicon.ico', 'fonts/**', 'offline/**', 'images/fallback.png']
  exclude: [],
  publicBaseUrl: 'https://cdn.example.com/assets/',
  storage: {
    provider: 's3',
    bucket: 'YOUR_EXISTING_BUCKET',
    region: 'us-east-1',
    prefix: 'assets',
  },
} satisfies UserConfig;`;
export const nextConfig = `import { withSimpcn } from '@simpcn/next';

export default withSimpcn({
  // Keep existing Next.js configuration here.
});`;
export const viteConfig = `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { simpcn } from '@simpcn/vite';

export default defineConfig({
  plugins: [simpcn(), react()],
});`;
export const Code = ({ code, label }: { code: string; label?: string }) => <CodeBlock code={code} label={label} />;
export const Note = ({ children }: { children: ReactNode }) => <aside className="docs-note">{children}</aside>;

