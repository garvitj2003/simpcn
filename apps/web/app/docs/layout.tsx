import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/navigation/site-header';
import { PackageManagerProvider } from '@/features/docs/install-command';
import '@/features/docs/docs.css';

export default function DocsLayout({ children }: { children: ReactNode }) {
  return <div className="docs-site"><a className="docs-skip" href="#docs-content">Skip to documentation</a><SiteHeader /><PackageManagerProvider>{children}</PackageManagerProvider></div>;
}
