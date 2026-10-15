"use client";

import { useId } from "react";
import { MotionScene } from "./motion-scene";
import "./problem-motion.css";

function FileGlyph({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 44 52" fill="none" aria-hidden="true">
      <defs><linearGradient id={id} x1="8" y1="4" x2="35" y2="47" gradientUnits="userSpaceOnUse"><stop stopColor="#e8f7ff" /><stop offset="1" stopColor="#8fc5e1" /></linearGradient></defs>
      <path d="M8 2h19l12 12v31a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5Z" fill={`url(#${id})`} stroke="#fff" strokeOpacity=".7" />
      <path d="M27 2v8a4 4 0 0 0 4 4h8" stroke="#fff" strokeOpacity=".8" />
      <path d="m15 24-5 5 5 5m13-10 5 5-5 5m-5-12-4 15" stroke="#427493" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Check() {
  return <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.5 8 3 3 6-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function ProblemMotion() {
  const id = useId().replaceAll(":", "");
  return (
    <MotionScene
      className="pm-scene"
      label="Manual reference changes compared with Simpcn production transforms"
      caption="Supported references change at build time; source stays unchanged."
    >
      <div className="pm-composition">
        <div className="pm-route pm-manual">
          <div className="pm-route-label"><span className="pm-route-dot" />Repeated source edits</div>
          <div className="pm-window-stack">
            {["Header.tsx", "Landing.tsx"].map((name, index) => (
              <div className={`pm-window pm-window-${index + 1}`} key={name}>
                <div className="pm-window-bar"><span className="pm-window-lights" aria-hidden="true"><i /><i /><i /></span><span>{name}</span></div>
                <div className="pm-code-row"><span aria-hidden="true">{index + 4}</span><code>&lt;img src=<span className="pm-reference">&quot;/images/hero.webp&quot;<span className="pm-edit-highlight" aria-hidden="true" /></span> /&gt;</code></div>
                <div className="pm-edit-note"><span aria-hidden="true">↳</span> Find. Replace. Repeat.</div>
              </div>
            ))}
          </div>
        </div>
        <div className="pm-route pm-automated">
          <div className="pm-route-label"><span className="pm-route-dot" />Same source. Different delivery.</div>
          <div className="pm-source-scene">
            <div className="pm-file-emblem"><FileGlyph id={`${id}-source`} /></div>
            <div className="pm-window pm-source-window">
              <div className="pm-window-bar"><span className="pm-window-lights" aria-hidden="true"><i /><i /><i /></span><span>Landing.tsx</span><span className="pm-source-check"><Check /> Unchanged</span></div>
              <div className="pm-code-row"><span aria-hidden="true">5</span><code>&lt;img src=&quot;/images/hero.webp&quot; /&gt;</code></div>
            </div>
            <div className="pm-delivery-chip"><span className="pm-delivery-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7 17h10a4 4 0 0 0 .5-8A5.5 5.5 0 0 0 7 8a4.5 4.5 0 0 0 0 9Z" stroke="currentColor" strokeWidth="1.5" /><path d="m10 12 2 2 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span><strong>Production output</strong><span>Supported reference → CDN URL</span></span><Check /></div>
          </div>
        </div>
      </div>
    </MotionScene>
  );
}
