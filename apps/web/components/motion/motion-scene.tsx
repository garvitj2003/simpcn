"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import "./motion-scene.css";

/** Shared lifecycle only: every section owns its illustration and finite timeline. */
export function MotionScene({ label, caption, className = "", children }: { label: string; caption?: string; className?: string; children: ReactNode }) {
  const element = useRef<HTMLElement>(null);
  const [playback, setPlayback] = useState<{ motion: "idle" | "running" | "paused" | "reduced"; cycle: number }>({ motion: "idle", cycle: 0 });

  useEffect(() => {
    if (!element.current) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inView = false;
    let hasEntered = false;
    let replayArmed = false;
    function update() {
      const motion = preference.matches ? "reduced" : !hasEntered ? "idle" : inView && !document.hidden ? "running" : "paused";
      setPlayback(current => current.motion === motion ? current : { ...current, motion });
    }
    const observer = typeof IntersectionObserver === "undefined" ? null : new IntersectionObserver(entries => {
      for (const entry of entries) {
        inView = entry.isIntersecting;
        if (!inView && hasEntered) replayArmed = true;
        if (inView && (!hasEntered || replayArmed)) {
          if (hasEntered && replayArmed) setPlayback(current => ({ ...current, cycle: current.cycle + 1 }));
          hasEntered = true;
          replayArmed = false;
        }
        update();
      }
    }, { threshold: 0, rootMargin: "0px 0px -32px 0px" });
    if (observer) observer.observe(element.current);
    else inView = hasEntered = true;
    update();
    preference.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer?.disconnect();
      preference.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return <figure ref={element} className={`motion-scene ${className}`} aria-label={label} data-motion={playback.motion} data-running={playback.motion === "running"} data-active={playback.motion === "running"} data-started={playback.motion === "running" || playback.motion === "paused"}>
    <div className="motion-scene-stage" key={playback.cycle}>{children}</div>
    <figcaption className="motion-scene-caption">{caption ?? label}</figcaption>
  </figure>;
}
