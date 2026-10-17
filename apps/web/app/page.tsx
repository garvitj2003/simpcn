import { ButtonLink } from "@/components/shared/button";
import { DeliveryPreview } from "@/components/hero/delivery-preview";
import { HeroBackground } from "@/components/hero/hero-background";
import { SiteHeader } from "@/components/navigation/site-header";
import { ProblemSolutionSection, WorkflowSection, CommunitySection, SiteFooter } from "@/components/home/home-sections";
import { CompatibilitySection } from "@/components/home/compatibility-section";
import { AssetReferenceDemo } from "@/components/home/asset-reference-demo";
import { SectionMotion } from "@/components/motion/section-motion";
import Link from "next/link";
import { NativeImagesSection } from "@/components/home/native-images-section";
import { QuickInstall } from "@/components/home/quick-install";
import "@/components/shared/typography.css";

const repo = "https://github.com/garvitj2003/simpcn";
const start = "/docs";

function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h16m-6-6 6 6-6 6"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function GithubIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.86c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.89 1.53 2.34 1.09 2.91.83.09-.65.35-1.09.64-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.65 0 0 .84-.27 2.75 1.02A9.58 9.58 0 0 1 12 6.82c.85 0 1.71.11 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.38.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" /></svg>;
}

export default function Home() {
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <SiteHeader />
    <main id="main" tabIndex={-1}><section className="hero" aria-labelledby="hero-title">
      <HeroBackground />
      <div className="hero-content">
        <div className="hero-intro">
        <div className="hero-heading">
          <h1 id="hero-title"><span>Your code stays the same.</span>{" "}<span>The assets move to CDN.</span></h1>
        </div>
        <p className="hero-description">Make asset migration easier. Move your <span className="public-highlight"><code>public/</code></span> assets to your desired storage provider, with supported asset references rewritten automatically during production builds—without manually updating your source code.</p>
        <p className="hero-platforms">Next.js · Vite · <Link href="/docs/react-native-expo">React Native with Expo (experimental)</Link></p>
        <div className="hero-actions"><ButtonLink href={start}>Get Started <Arrow /></ButtonLink><ButtonLink variant="secondary" href={repo}><GithubIcon />View on GitHub <Arrow diagonal /></ButtonLink></div>
        </div>
        <DeliveryPreview />
      </div>
    </section>
    <SectionMotion>
    <QuickInstall />
    <ProblemSolutionSection />
    <AssetReferenceDemo />
    <WorkflowSection />
    <NativeImagesSection />
    <CompatibilitySection />
    <CommunitySection />
    </SectionMotion>
    </main>
    <SiteFooter />
  </>;
}
