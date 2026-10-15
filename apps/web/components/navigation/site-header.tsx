import Link from "next/link";
import { ButtonLink } from "@/components/shared/button";
import { LogoMark } from "@/components/shared/logo-mark";
import { ThemeToggle } from "./theme-toggle";
import "./navbar.css";

const repo = "https://github.com/garvitj2003/simpcn";
function Arrow({ diagonal = false }: { diagonal?: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d={diagonal ? "M6 18 18 6M6 6h12v12" : "M4 12h16m-6-6 6 6-6 6"} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function NavigationLinks() {
  return <><ButtonLink variant="link" href="/docs">Docs</ButtonLink><ButtonLink variant="link" href={repo}>GitHub <Arrow diagonal /></ButtonLink><ButtonLink variant="link" href="https://www.npmjs.com/package/simpcn">npm <Arrow diagonal /></ButtonLink></>;
}
export function SiteHeader() {
  return <header className="site-header"><div className="nav-shell">
    <Link className="brand nav-island" href="/" aria-label="Simpcn home"><LogoMark className="brand-mark" />Simpcn<span className="brand-period">.</span></Link>
    <nav className="desktop-nav nav-island" aria-label="Main navigation"><NavigationLinks /></nav>
    <div className="nav-actions nav-island"><ButtonLink size="sm" className="nav-cta" href="/docs">Get Started <Arrow /></ButtonLink><ThemeToggle /><details className="mobile-menu"><summary aria-label="Toggle navigation"><span /><span /></summary><nav aria-label="Mobile navigation"><NavigationLinks /></nav></details></div>
  </div></header>;
}
