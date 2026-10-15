import Link from "next/link";
import { LogoMark } from "@/components/shared/logo-mark";
import { ButtonLink } from "@/components/shared/button";
import { ProblemMotion } from "@/components/motion/problem-motion";
import { WorkflowMotion } from "@/components/motion/workflow-motion";
import { FaqMotion, CommunityMotion } from "@/components/motion/community-motion";
import "./home-sections.css";

const repository = "https://github.com/garvitj2003/simpcn";

export function ProblemSolutionSection() {
  return (
    <section id="problem" className="home-section home-problem" aria-labelledby="problem-title">
      <div className="home-section-heading">
        <h2 id="problem-title">Moving assets is easy.<br />Updating every reference isn’t.</h2>
        <p>Moving files is one task. Keeping every reference in sync is another.</p>
      </div>
      <ProblemMotion />
      <div className="home-comparison">
        <div className="home-comparison-side">
          <h3>The manual route</h3>
          <p>Upload assets, then find and replace references across the source.</p>
        </div>
        <div className="home-comparison-side home-comparison-simpcn">
          <h3>With Simpcn</h3>
          <p>Migrate assets. The production build rewrites supported references.</p>
        </div>
      </div>
      <p className="home-section-note">Automatic rewriting has a defined scope. <Link href="/docs/supported-references">See which references are supported <span aria-hidden="true">↗</span></Link></p>
    </section>
  );
}

const workflow = [
  {
    title: "Discover",
    description: "Scan and fingerprint assets before uploading.",
    command: "npx simpcn plan",
  },
  {
    title: "Migrate",
    description: "Upload what’s needed and verify remote metadata.",
    command: "npx simpcn migrate",
  },
  {
    title: "Transform",
    description: "Rewrite supported references using verified deployment records.",
    command: "npm run build",
  },
];

export function WorkflowSection() {
  return (
    <section id="how-it-works" className="home-section home-workflow" aria-labelledby="workflow-title">
      <div className="home-section-heading home-heading-split">
        <h2 id="workflow-title">Plan it. Move it.<br />Keep writing code.</h2>
        <p>Preview first. Migrate next. Transform at build time.</p>
      </div>
      <WorkflowMotion />
      <ol className="home-workflow-list">
        {workflow.map((step, index) => (
          <li key={step.title}>
            <span className="home-workflow-number" aria-hidden="true">0{index + 1}</span>
            <div className="home-workflow-copy"><h3>{step.title}</h3><p>{step.description}</p></div>
            <div className="home-workflow-command"><code>{step.command}</code></div>
          </li>
        ))}
      </ol>
      <div className="home-benefits">
        <h3>A different delivery path.<br />The same everyday workflow.</h3>
        <dl>
          <div><dt>Fewer manual edits</dt><dd>Supported references change at build time.</dd></div>
          <div><dt>Local stays local</dt><dd>Development keeps local asset paths.</dd></div>
          <div><dt>Incremental migration</dt><dd>Matching remote objects are verified and skipped.</dd></div>
          <div><dt>Storage ownership</dt><dd>Use configured S3-compatible storage and delivery URLs.</dd></div>
          <div><dt>Framework integration</dt><dd>Next.js and Vite adapters fit the existing build.</dd></div>
        </dl>
      </div>
    </section>
  );
}

const questions = [
  {
    question: "Does Simpcn edit source files?",
    answer: <>The migration and supported reference transforms do not rewrite application source files. Original <code>public/</code> files stay in place. The framework integration changes supported references in production build output. <Link href="/docs/supported-references">Check the reference support guide.</Link></>,
  },
  {
    question: "Does every asset reference work automatically?",
    answer: <>No. Static supported references can be transformed; arbitrary JavaScript strings, API responses, and dynamic paths are not automatically rewritten. Known dynamic asset paths can use the integration’s <code>assetUrl()</code> helper. Next.js CSS rewriting and Vue/Svelte template transforms are not implemented. <Link href="/docs/limitations">Read the limitations.</Link></>,
  },
  {
    question: "Which storage providers are supported?",
    answer: <>The S3-compatible adapter has configuration for AWS S3, Cloudflare R2, and MinIO. Live integration tests currently cover local MinIO; AWS S3 and R2 have not been live-validated. The bucket, public access, and any CDN must already be configured. Simpcn does not provision them. <Link href="/docs/storage">See storage setup.</Link></>,
  },
  {
    question: "What happens when assets change or are removed?",
    answer: <>The next plan reports new, changed, unchanged, and locally removed assets. Migration verifies remote metadata and skips matching objects. Differing or unverified objects need <code>--overwrite</code> to replace them. Removed local files are reported; remote objects are kept. Review CDN caching after replacements. <Link href="/docs/cli">Explore the CLI.</Link></>,
  },
  {
    question: "Do production builds upload assets?",
    answer: <>No. Run migration before the application build. Builds read local deployment records and fail when a managed reference lacks matching verification. Those records describe a previous storage check, not a guarantee that a CDN URL is currently public or cached correctly. <Link href="/docs">Read the setup guide.</Link></>,
  },
  {
    question: "Can Simpcn replace an image optimization service?",
    answer: <>Simpcn migrates assets and changes delivery URLs. It does not resize or optimize images. Supported static <code>next/image</code> references use direct CDN delivery with <code>unoptimized</code>; conflicting loader or optimization settings are left unchanged with a diagnostic. <Link href="/docs/limitations">Review the integration limits.</Link></>,
  },
];

export function CommunitySection() {
  return (
    <>
      <section id="faq" className="home-section home-faq" aria-labelledby="faq-title">
        <div className="home-section-heading"><h2 id="faq-title">A few things to know.</h2><p>Scope, storage, and the details that matter.</p><FaqMotion /></div>
        <div className="home-faq-list">
          {questions.map(({ question, answer }) => <details key={question}><summary>{question}<span aria-hidden="true" className="home-faq-plus">+</span></summary><div className="home-faq-answer"><p>{answer}</p></div></details>)}
        </div>
      </section>
      <section id="community" className="home-section home-community" aria-labelledby="community-title">
        <div><p className="home-release-note">Open source · v0.1</p><h2 id="community-title">Build with it.<br />Help shape what’s next.</h2><p>Try it. Share a rough edge. Contribute a fix.</p><div className="home-community-actions"><ButtonLink href="/docs">Get started <span aria-hidden="true">↗</span></ButtonLink><ButtonLink href={`${repository}/issues/new`} variant="secondary">Report an issue <span aria-hidden="true">↗</span></ButtonLink></div></div>
        <div className="home-community-aside"><CommunityMotion /><nav aria-label="Open-source community" className="home-community-links"><a href={`${repository}/issues`}>Discuss a bug or idea <span aria-hidden="true">↗</span></a><a href={`${repository}/pulls`}>Explore contributions <span aria-hidden="true">↗</span></a><a href="https://www.npmjs.com/package/simpcn">Find Simpcn on npm <span aria-hidden="true">↗</span></a></nav></div>
      </section>
    </>
  );
}

export function SiteFooter() {
  return <footer className="home-footer"><div><Link href="/" className="home-footer-brand" aria-label="Simpcn home"><LogoMark />Simpcn<span>.</span></Link><p>Same source. A new delivery path.</p></div><nav aria-label="Footer"><Link href="/docs">Docs</Link><a href={repository}>GitHub</a><a href="https://www.npmjs.com/package/simpcn">npm</a><a href={`${repository}/blob/main/LICENSE`}>MIT license</a></nav></footer>;
}
