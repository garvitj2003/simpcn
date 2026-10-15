"use client";

import { useId } from "react";
import { MotionScene } from "./motion-scene";
import "./reference-motion.css";

// Share the exact route between the visible guide and the file's motion path.
const deliveryPath = "M73 70C156 70 166 22 260 28C344 34 368 70 447 70";

export function ReferenceMotion({ production }: { production: boolean }) {
  const id = useId().replace(/:/g, "");
  return (
    <MotionScene
      className="rm-scene"
      label="One source reference, two delivery destinations"
      caption={production ? "Verified assets resolve to the configured CDN URL." : "Local assets during development."}
    >
      <div className="rm-content" data-production={production}>
        <div className="rm-source-window">
          <div className="rm-window-bar"><span className="rm-lights" aria-hidden="true"><i /><i /><i /></span><span>Component</span><span className="rm-unchanged">✓ Unchanged</span></div>
          <code>&lt;img src=&quot;/images/hero.webp&quot; alt=&quot;Product preview&quot; /&gt;</code>
        </div>
        <svg className="rm-routing" viewBox="0 0 520 164" fill="none" aria-hidden="true">
          <defs>
            <linearGradient id={`${id}-photo`} x1="0" y1="0" x2="0" y2="44" gradientUnits="userSpaceOnUse"><stop stopColor="#bde8fa" /><stop offset="1" stopColor="#78b5d4" /></linearGradient>
            <linearGradient id={`${id}-folder`} x1="0" y1="0" x2="0" y2="62" gradientUnits="userSpaceOnUse"><stop stopColor="#a8d9ee" /><stop offset="1" stopColor="#4c98bd" /></linearGradient>
          </defs>
          <path className="rm-route" d={deliveryPath} />
          <g transform="translate(34 39)">
            <path d="M0 11a7 7 0 0 1 7-7h20l8 9h35a7 7 0 0 1 7 7v37a7 7 0 0 1-7 7H7a7 7 0 0 1-7-7Z" fill={`url(#${id}-folder)`} stroke="white" strokeOpacity=".55" />
            <rect x="3" y="20" width="71" height="43" rx="6" fill="#7fc5e5" stroke="white" strokeOpacity=".35" />
            <path d="M9 24h59" stroke="white" strokeOpacity=".65" strokeLinecap="round" />
          </g>
          <g transform="translate(229 39)">
            <rect width="62" height="62" rx="16" className="rm-node" />
            <path d="m21 22-9 9 9 9m20-18 9 9-9 9m-13 5 6-28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <g transform="translate(408 37)" className="rm-destination rm-local-node">
            <rect width="78" height="58" rx="9" className="rm-node" />
            <path d="M1 14h76M24 66h30m-15-8v8" stroke="currentColor" strokeOpacity=".45" strokeWidth="2" strokeLinecap="round" />
            <circle cx="9" cy="8" r="2" fill="#ef9c94" /><circle cx="16" cy="8" r="2" fill="#e6cb83" /><circle cx="23" cy="8" r="2" fill="#9fcaaf" />
            <path d="m28 33 8 7 14-14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <g transform="translate(403 34)" className="rm-destination rm-cdn-node">
            <path d="M20 58a18 18 0 0 1-1-36 25 25 0 0 1 46-3 20 20 0 0 1 0 39Z" className="rm-cloud" />
            <circle cx="43" cy="35" r="13" stroke="currentColor" strokeWidth="1.5" /><ellipse cx="43" cy="35" rx="6" ry="13" stroke="currentColor" strokeWidth="1.2" /><path d="M30 35h26M43 22v26M8 8l13 11m50 43 9 8M77 5 65 17" stroke="currentColor" strokeWidth="1.2" />
            <rect x="0" y="0" width="12" height="10" rx="3" className="rm-node" /><rect x="76" y="0" width="12" height="10" rx="3" className="rm-node" /><rect x="75" y="67" width="12" height="10" rx="3" className="rm-node" />
          </g>
          <g className="rm-file-track" style={{ offsetPath: `path('${deliveryPath}')` }}><g className="rm-file">
            <rect x="-14" y="-18" width="28" height="36" rx="5" fill="var(--surface-strong)" stroke="var(--border)" />
            <rect x="-10" y="-13" width="20" height="23" rx="3" fill={`url(#${id}-photo)`} />
            <circle cx="5" cy="-7" r="2.5" fill="#fff2c9" /><path d="m-10 9 7-10 5 6 4-4 4 8" fill="#568daa" />
            <path d="M-7 14H7" stroke="var(--muted)" strokeOpacity=".4" strokeWidth="2" strokeLinecap="round" />
          </g></g>
          <text x="73" y="137" textAnchor="middle">public/</text>
          <text x="260" y="137" textAnchor="middle">{production ? "Production build" : "Development"}</text>
          <text x="447" y="137" textAnchor="middle">{production ? "Configured CDN" : "Local server"}</text>
        </svg>
        <div className="rm-resolved"><span>{production ? "Production asset URL" : "Development asset URL"}</span><code>{production ? "https://cdn.example.com/assets/images/hero.webp" : "/images/hero.webp"}</code></div>
      </div>
    </MotionScene>
  );
}
