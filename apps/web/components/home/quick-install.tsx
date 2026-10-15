"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Button } from "@/components/shared/button";
import { CodeBlock } from "@/components/shared/code-block";
import "./quick-install.css";

const managers = {
  npm: "npm i -D simpcn",
  pnpm: "pnpm add -D simpcn",
  bun: "bun add -d simpcn",
  yarn: "yarn add -D simpcn",
} as const;
type Manager = keyof typeof managers;

const managerNames = Object.keys(managers) as Manager[];
const initialize = {
  npm: "npx simpcn init",
  pnpm: "pnpm exec simpcn init",
  bun: "bun run simpcn init",
  yarn: "yarn simpcn init",
} as const;

export function QuickInstall({ variant = "landing" }: { variant?: "landing" | "docs" }) {
  const embedded = variant === "docs";
  const [manager, setManager] = useState<Manager>("npm");
  const [entered, setEntered] = useState(false);
  const [notice, setNotice] = useState<{ command: string; kind: "copied" | "error" } | null>(null);
  const element = useRef<HTMLElement>(null);
  const selector = useRef<HTMLDivElement>(null);
  const indicator = useRef<HTMLSpanElement>(null);
  const selected = useRef<Manager>("npm");
  const frame = useRef(0);
  const motion = useRef({ left: 3, right: 43, leftVelocity: 0, rightVelocity: 0, targetLeft: 3, targetRight: 43, baseWidth: 40 });
  const reset = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const command = managers[manager];
  const status = notice?.command === command ? notice.kind : null;

  useEffect(() => {
    if (!element.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      setEntered(true);
      observer.disconnect();
    }, { threshold: .25 });
    observer.observe(element.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => () => clearTimeout(reset.current), []);

  function moveIndicator(next: Manager, immediate = false) {
    const button = selector.current?.querySelector<HTMLButtonElement>(`[data-manager="${next}"]`);
    const pill = indicator.current;
    if (!button || !pill) return;
    cancelAnimationFrame(frame.current);
    const state = motion.current;
    state.targetLeft = button.offsetLeft;
    state.targetRight = button.offsetLeft + button.offsetWidth;
    state.baseWidth = pill.offsetWidth;
    function paint() {
      if (indicator.current) indicator.current.style.transform = `translateX(${state.left}px) scaleX(${Math.max(1, state.right - state.left) / state.baseWidth})`;
    }
    if (immediate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      state.left = state.targetLeft;
      state.right = state.targetRight;
      state.leftVelocity = state.rightVelocity = 0;
      paint();
      return;
    }
    // The leading edge moves first; the trailing edge catches up with its velocity intact.
    const goingRight = state.targetLeft > state.left;
    const leftFrequency = 2 * Math.PI / (goingRight ? .36 : .26);
    const rightFrequency = 2 * Math.PI / (goingRight ? .26 : .36);
    let previous = performance.now();
    function tick(now: number) {
      let remaining = Math.min((now - previous) / 1000, .032);
      previous = now;
      while (remaining > 0) {
        const step = Math.min(remaining, 1 / 120);
        state.leftVelocity += (-(leftFrequency ** 2) * (state.left - state.targetLeft) - 1.6 * leftFrequency * state.leftVelocity) * step;
        state.rightVelocity += (-(rightFrequency ** 2) * (state.right - state.targetRight) - 1.6 * rightFrequency * state.rightVelocity) * step;
        state.left += state.leftVelocity * step;
        state.right += state.rightVelocity * step;
        remaining -= step;
      }
      const resting = Math.abs(state.left - state.targetLeft) < .02 && Math.abs(state.right - state.targetRight) < .02 && Math.abs(state.leftVelocity) < .1 && Math.abs(state.rightVelocity) < .1;
      if (resting) {
        state.left = state.targetLeft;
        state.right = state.targetRight;
        state.leftVelocity = state.rightVelocity = 0;
      }
      paint();
      if (!resting) frame.current = requestAnimationFrame(tick);
    }
    frame.current = requestAnimationFrame(tick);
  }

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const align = () => moveIndicator(selected.current, true);
    align();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(align);
    if (selector.current) observer?.observe(selector.current);
    preference.addEventListener("change", align);
    return () => {
      cancelAnimationFrame(frame.current);
      observer?.disconnect();
      preference.removeEventListener("change", align);
    };
  }, []);

  function select(next: Manager) {
    if (next === selected.current) return;
    selected.current = next;
    moveIndicator(next);
    setManager(next);
    setEntered(true);
    setNotice(null);
    clearTimeout(reset.current);
  }
  async function copy() {
    clearTimeout(reset.current);
    try {
      await navigator.clipboard.writeText(command);
      setNotice({ command, kind: "copied" });
      reset.current = setTimeout(() => setNotice(null), 2200);
    } catch {
      setNotice({ command, kind: "error" });
    }
  }

  return <section className={`quick-install${embedded ? " quick-install-docs" : ""}`} aria-labelledby={embedded ? undefined : "quick-install-title"} aria-label={embedded ? "Install Simpcn" : undefined} ref={element}>
    {!embedded && <div className="quick-install-heading">
      <h2 id="quick-install-title">It starts with a single command.</h2>
      <p>Add Simpcn as a dev dependency.</p>
    </div>}
    <div className="quick-install-shell" role="group" aria-label="Installation terminal">
      <div className="quick-install-toolbar">
        <span className="quick-install-lights" aria-hidden="true"><i /><i /><i /></span>
        <span className="quick-install-terminal-title">simpcn — install</span>
        <div className="quick-install-managers" ref={selector} role="group" aria-label="Choose a package manager">
          <span className="quick-install-indicator" ref={indicator} aria-hidden="true" />
          {managerNames.map(name => <Button key={name} data-manager={name} variant="secondary" size="sm" aria-pressed={manager === name} aria-controls="quick-install-command" onClick={() => select(name)}>{name}</Button>)}
        </div>
      </div>
      <div className="quick-install-command-row">
        <pre id="quick-install-command" tabIndex={0} aria-label={`${manager} install command`}><span className="quick-install-prompt" aria-hidden="true">$</span><span key={manager} className="quick-install-typed" data-typing={entered} style={{ "--typing-characters": command.length } as CSSProperties}><code>{command}</code><span className="quick-install-cursor" aria-hidden="true" /></span></pre>
        <Button variant="washed" size="sm" className="quick-install-copy" onClick={copy} aria-label={status === "copied" ? "Install command copied" : "Copy install command"}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">{status === "copied" ? <path d="m5 12 4 4L19 6" /> : <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V4H4v12h4" /></>}</svg>{status === "copied" ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
    {!embedded && <div className="quick-install-footer"><Link href="/docs">Continue setup <span aria-hidden="true">↗</span></Link></div>}
    {embedded && <details className="quick-install-next">
      <summary>Continue with the CLI</summary>
      <div>
        <p>Use Node.js 24.11 or later. Run the guided setup in the application directory:</p>
        <CodeBlock code={initialize[manager]} label="Guided setup" language="sh" />
        <p>Follow the prompts to create the configuration and install the adapter. Then finish connecting the framework: <Link href="/docs/nextjs">Next.js</Link> or <Link href="/docs/vite">Vite</Link>.</p>
        <Link href="/docs/cli#init">CLI setup reference <span aria-hidden="true">↗</span></Link>
      </div>
    </details>}
    <span className="sr-only" role="status">{status === "copied" ? "Install command copied to clipboard." : ""}</span>
    {status === "error" && <p className="quick-install-error" role="status">Clipboard unavailable. Select the command to copy it manually.</p>}
  </section>;
}
