import type { Metadata } from 'next';
import { DocPage } from '@/features/docs/doc-page';
import { docs } from '@/features/docs/content';

export const metadata: Metadata = {
  title: 'Getting started — Simpcn docs',
  description: docs[0].description,
  alternates: { canonical: '/docs' },
};
export default function GettingStartedPage() { return <DocPage doc={docs[0]} />; }
