"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { Button } from "@/components/shared/button";
import { SourceReference } from "./source-reference";
import { AssetScene } from "./asset-scene";
import output from "./terminal-output.json";
import "./delivery-demo.css";

// Generated with packages/cli/src/output.ts for public/window.svg.
// Framework-specific build output is deliberately left to the diagram.
const demoTiming = {
  commandCharacter: 45,
  outputCharacter: 12,
  readingPause: 1000,
  fileTransfer: 1000,
} as const;

const stages = [
  { label: "Plan", command: "npx simpcn plan", description: "See what will move. Nothing changes yet.", output: output.plan },
  { label: "Migrate", command: "npx simpcn migrate", description: "Your asset moves to your storage. Your source stays untouched.", output: output.migrate },
  { label: "Build", command: "pnpm run build", description: "Supported references now resolve to your CDN in production.", output: "" },
] as const;
const deliveryCaptions = [
  { title: "Before migration", detail: "Your assets are served from your application’s public/ directory." },
  { title: "After migration + build", detail: "Your migrated assets are served from your CDN. Your source stays the same." },
] as const;

const frames = [
  { stage: 0, result: false, stored: false, delivered: false, dwell: stages[0].command.length * demoTiming.commandCharacter + 200 },
  { stage: 0, result: true, stored: false, delivered: false, dwell: stages[0].output.length * demoTiming.outputCharacter + demoTiming.readingPause },
  { stage: 1, result: false, stored: false, delivered: false, dwell: stages[1].command.length * demoTiming.commandCharacter + 200 },
  { stage: 1, result: false, stored: true, delivered: false, dwell: demoTiming.fileTransfer + 200 },
  { stage: 1, result: true, stored: true, delivered: false, dwell: stages[1].output.length * demoTiming.outputCharacter + demoTiming.readingPause },
  { stage: 2, result: false, stored: true, delivered: false, dwell: stages[2].command.length * demoTiming.commandCharacter + 200 },
  { stage: 2, result: true, stored: true, delivered: true, dwell: 0 },
] as const;

function DeliveryCaption({ delivered }: { delivered: boolean }) {
  return <div className="demo-caption-states">{deliveryCaptions.map((caption, index) => {
    const active = delivered === (index === 1);
    return <p className="demo-phase-caption" data-active={active} aria-hidden={!active} key={caption.title}>
      <strong>{caption.title}</strong><span>{caption.detail}</span>
    </p>;
  })}</div>;
}
const settledFrames = [1, 4, 6];
const productionUrl = "https://cdn.example.com/assets/window.svg";


function subscribeMotionPreference(callback: () => void) {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  preference.addEventListener("change", callback);
  return () => preference.removeEventListener("change", callback);
}
const getMotionPreference = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const getServerMotionPreference = () => true;

function TypedOutput({ text, animate, playing }: { text: string; animate: boolean; playing: boolean }) {
  const reducedMotion = useSyncExternalStore(subscribeMotionPreference, getMotionPreference, getServerMotionPreference);
  const [revealed, setRevealed] = useState(0);
  const elapsed = useRef(0);

  useEffect(() => {
    if (!animate || reducedMotion || !playing) return;
    const start = performance.now() - elapsed.current;
    let request = 0;
    function tick(now: number) {
      const count = Math.min(text.length, Math.floor((now - start) / demoTiming.outputCharacter));
      setRevealed(count);
      if (count < text.length) request = window.requestAnimationFrame(tick);
    }
    request = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(request);
      elapsed.current = Math.min(text.length * demoTiming.outputCharacter, performance.now() - start);
    };
  }, [text, animate, playing, reducedMotion]);

  return <code className="demo-output-text">
    <span className="sr-only">{text}</span>
    <span className="demo-output-reserved" aria-hidden="true">{text}</span>
    <span className="demo-output-live" aria-hidden="true">{animate && !reducedMotion ? text.slice(0, revealed) : text}</span>
  </code>;
}

function TypedCommand({ command, typing }: { command: string; typing: boolean }) {
  return <code className="demo-typed-command" data-typing={typing} style={{
    "--command-length": command.length,
    "--typing-duration": `${command.length * demoTiming.commandCharacter}ms`,
  } as CSSProperties}>
    <span className="sr-only">{command}</span>
    <span aria-hidden="true">{Array.from(command).map((character, index) => <span className="demo-typed-character" key={index} style={{ animationDelay: `${(index + 1) * demoTiming.commandCharacter}ms` }}>{character}</span>)}</span>
    {typing && <span className="demo-typing-cursor" aria-hidden="true" />}
  </code>;
}

function WindowControls() {
  return <div className="demo-traffic-lights" aria-hidden="true">
    <span className="demo-light demo-light-close"><svg viewBox="0 0 12 12"><path d="m4 4 4 4m0-4L4 8" /></svg></span>
    <span className="demo-light demo-light-minimize"><svg viewBox="0 0 12 12"><path d="M3 6h6" /></svg></span>
    <span className="demo-light demo-light-fullscreen"><svg viewBox="0 0 12 12"><path d="M3 7V3h4L3 7Zm6-2v4H5l4-4Z" /></svg></span>
  </div>;
}

export function DeliveryPreview() {
  const [playback, setPlayback] = useState({ index: 1, running: false, motion: true, animateOutput: false });
  const [manualTransfer, setManualTransfer] = useState(false);
  const [sceneRevision, setSceneRevision] = useState(0);
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);
  const root = useRef<HTMLElement>(null);
  const started = useRef(false);
  const timing = useRef({ index: -1, remaining: 0 });
  const frame = frames[playback.index];
  const stage = stages[frame.stage];
  const flowRunning = inView && tabVisible;

  useEffect(() => {
    if (!playback.running || !flowRunning) return;
    const clock = timing.current;
    if (clock.index !== playback.index) {
      clock.index = playback.index;
      clock.remaining = frames[playback.index].dwell;
    }
    const deadline = performance.now() + clock.remaining;
    const timer = window.setTimeout(() => {
      setPlayback(current => {
        const index = Math.min(current.index + 1, frames.length - 1);
        return { ...current, index, running: index !== frames.length - 1 };
      });
    }, clock.remaining);
    return () => {
      window.clearTimeout(timer);
      clock.remaining = Math.max(0, deadline - performance.now());
    };
  }, [playback.running, playback.index, flowRunning]);

  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const visibility = () => setTabVisible(!document.hidden);
    const motion = () => {
      if (preference.matches) setPlayback(current => ({ ...current, running: false, motion: false }));
    };
    const observer = new IntersectionObserver(entries => {
      setInView(entries[0].isIntersecting);
      if (!entries[0].isIntersecting) return;
      if (started.current || document.hidden) return;
      started.current = true;
      if (!preference.matches) setPlayback({ index: 0, running: true, motion: true, animateOutput: true });
    }, { threshold: 0.35 });
    observer.observe(element);
    document.addEventListener("visibilitychange", visibility);
    preference.addEventListener("change", motion);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      preference.removeEventListener("change", motion);
    };
  }, []);

  function selectStage(index: number, pointer: boolean) {
    started.current = true;
    timing.current.index = -1;
    setManualTransfer(index === 1 && pointer);
    if (index === 1) setSceneRevision(current => current + 1);
    setPlayback({ index: settledFrames[index], running: false, motion: pointer, animateOutput: false });
  }

  function replay(pointer: boolean) {
    started.current = true;
    timing.current.index = -1;
    setManualTransfer(false);
    setSceneRevision(current => current + 1);
    setPlayback({ index: 0, running: true, motion: pointer, animateOutput: true });
  }

  const typing = playback.index === 0 || playback.index === 2 || playback.index === 5;

  return <figure ref={root} className="delivery-demo" style={{ "--demo-transfer-duration": `${demoTiming.fileTransfer}ms` } as CSSProperties} data-motion={playback.motion} data-stage={frame.stage} data-running={playback.running && flowRunning} data-flow-running={flowRunning} data-transfer-running={(playback.running || manualTransfer) && flowRunning} data-finished={playback.index === frames.length - 1} aria-label="How Simpcn moves assets without changing your source">
    <div className="demo-files">
      <AssetScene key={sceneRevision} stored={frame.stored} delivered={frame.delivered} animate={(playback.animateOutput || manualTransfer) && playback.motion} />
      <div className="demo-delivery-explanation" role="status" aria-live="polite" aria-atomic="true">
        <DeliveryCaption delivered={frame.delivered} />
      </div>
      <SourceReference />
    </div>
    <div className="demo-controls">
      <div className="demo-steps" role="group" aria-label="Migration steps">
        {stages.map((item, index) => <button type="button" key={item.label} aria-pressed={frame.stage === index} aria-controls="simpcn-terminal" onClick={event => selectStage(index, event.detail !== 0)}><span aria-hidden="true">0{index + 1}</span> {item.label}</button>)}
      </div>
      {playback.index === frames.length - 1 && <Button variant="washed" size="sm" onClick={event => replay(event.detail !== 0)} aria-label="Replay demo">Replay</Button>}
    </div>
    <div className="demo-terminal" id="simpcn-terminal" role="region" aria-label={`${stage.label} command demonstration`}>
      <div className="demo-window-bar"><WindowControls /><span>simpcn — zsh</span><svg className="demo-window-mark" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 4 4 4-4 4m6 0h4" /></svg></div>
      <div className="demo-terminal-body" tabIndex={0}>
        <div className="demo-terminal-context"><span>~/my-project</span><span>Illustrative demo</span></div>
        {stages.slice(0, frame.stage).map(item => <div className="demo-command-history" key={item.label}><span aria-hidden="true">✓</span><code>{item.command}</code></div>)}
        <div className="demo-active-command"><span aria-hidden="true">❯</span><TypedCommand key={frame.stage} command={stage.command} typing={typing} /></div>
        <pre className="demo-output" style={{ opacity: frame.result ? 1 : 0 }} aria-hidden={!frame.result}><TypedOutput key={`${frame.stage}-${frame.result}`} text={stage.output} animate={playback.animateOutput && playback.motion && frame.result} playing={(playback.running || frame.delivered) && flowRunning} /></pre>
        {frame.delivered && <div className="demo-production-result"><span>Production asset URL</span><TypedOutput text={productionUrl} animate={playback.animateOutput && playback.motion} playing={flowRunning} /></div>}
        {frame.result && <div className="demo-shell-prompt" data-wait={playback.animateOutput} style={{ animationDelay: `${(frame.delivered ? productionUrl.length : stage.output.length) * demoTiming.outputCharacter + 180}ms` }} aria-hidden="true">❯ <span /></div>}
      </div>
      <div className="demo-terminal-footer"><span className="demo-status-dot" />{frame.stage === 0 ? "Dry run. No changes made." : frame.stage === 1 ? "Assets move. Source stays." : "Local in dev. CDN in production."}</div>
    </div>
    <figcaption className="demo-caption">
      <span>Example assumes Simpcn is installed and configured. CDN URL is illustrative.</span>
    </figcaption>
  </figure>;
}
