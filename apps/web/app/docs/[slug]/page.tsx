import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DocPage } from '@/features/docs/doc-page';
import { docs, docHref } from '@/features/docs/content';

type Props = { params: Promise<{ slug: string }> };
export function generateStaticParams() { return docs.filter(doc => doc.slug).map(doc => ({ slug: doc.slug })); }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = docs.find(item => item.slug === slug);
  if (!doc) return {};
  return { title: `${doc.title} — Simpcn docs`, description: doc.description, alternates: { canonical: docHref(doc) } };
}
export default async function DocumentationPage({ params }: Props) {
  const { slug } = await params;
  const doc = docs.find(item => item.slug === slug);
  if (!doc) notFound();
  return <DocPage doc={doc} />;
}
