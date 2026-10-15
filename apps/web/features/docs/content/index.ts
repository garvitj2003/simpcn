import type { Doc } from '../types';
import { gettingStarted } from './getting-started';
import { nextjs } from './nextjs';
import { vite } from './vite';
import { storage } from './storage';
import { cli } from './cli';
import { supportedReferences } from './supported-references';
import { limitations } from './limitations';
import { troubleshooting } from './troubleshooting';

export type { Doc, DocSection } from '../types';
export const docs: Doc[] = [gettingStarted, nextjs, vite, storage, cli, supportedReferences, limitations, troubleshooting];

export function docHref(doc: Doc) { return doc.slug ? `/docs/${doc.slug}` : '/docs'; }
