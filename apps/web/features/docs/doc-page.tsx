import Link from 'next/link';
import { docs, docHref, type Doc } from './content';

function Navigation({ current }: { current: Doc }) {
  return <nav aria-label="Documentation"><p className="docs-nav-label">Documentation <span>v0.1.3</span></p><ul>{docs.map(doc => <li key={doc.slug}><Link href={docHref(doc)} aria-current={current.slug === doc.slug ? 'page' : undefined}>{doc.title}</Link></li>)}</ul><a className="docs-source-link" href="https://github.com/garvitj2003/simpcn">View source <span aria-hidden="true">↗</span></a></nav>;
}

export function DocPage({ doc }: { doc: Doc }) {
  const index = docs.findIndex(item => item.slug === doc.slug);
  const previous = docs[index - 1];
  const next = docs[index + 1];
  return <div className="docs-shell">
    <aside className="docs-sidebar"><Navigation current={doc} /></aside>
    <details className="docs-mobile-nav"><summary>Browse documentation <span aria-hidden="true">⌄</span></summary><Navigation current={doc} /></details>
    <main id="docs-content" className="docs-article" tabIndex={-1}>
      <div className="docs-breadcrumb"><Link href="/">Simpcn</Link><span aria-hidden="true">/</span><Link href="/docs">Docs</Link>{doc.slug && <><span aria-hidden="true">/</span><span>{doc.title}</span></>}</div>
      <header className="docs-page-heading"><p className="docs-eyebrow">The Simpcn handbook</p><h1>{doc.headline ?? doc.title}</h1><p>{doc.description}</p></header>
      {doc.intro}
      {doc.sections.length > 0 && <nav className="docs-on-page" aria-label="On this page"><p>On this page</p><ul>{doc.sections.map(section => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ul></nav>}
      {doc.sections.map(section => <section className="docs-section" key={section.id} aria-labelledby={section.id}><h2 id={section.id}><a href={`#${section.id}`}>{section.title}<span className="docs-anchor" aria-hidden="true">#</span></a></h2>{section.body}</section>)}
      <nav className="docs-pagination" aria-label="Adjacent guides">{previous ? <Link href={docHref(previous)}><span>← Previous</span><strong>{previous.title}</strong></Link> : <span />}{next && <Link href={docHref(next)}><span>Next →</span><strong>{next.title}</strong></Link>}</nav>
      <footer className="docs-footer"><p>Something unclear? <a href="https://github.com/garvitj2003/simpcn/issues/new">Open an issue</a>.</p><p>Simpcn v0.1.3 · Experimental integrations are labeled.</p></footer>
    </main>
  </div>;
}
