import type { ReactNode } from 'react';

export type DocSection = { id: string; title: string; body: ReactNode };
export type Doc = { slug: string; title: string; headline?: string; description: string; intro?: ReactNode; sections: DocSection[] };
