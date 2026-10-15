"use client";

import { useId } from "react";
import { MotionScene } from "./motion-scene";
import "./workflow-motion.css";

function DoneMark({ className = "" }: { className?: string }) {
  return <span className={`wm-done ${className}`} aria-hidden="true"><svg viewBox="0 0 20 20" fill="none"><path d="m5 10 3.5 3.5L15 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg></span>;
}

function DiscoverIcon({ id }: { id: string }) {
  return (
    <svg className="wm-icon" viewBox="0 0 180 160" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-folder`} x1="48" y1="58" x2="118" y2="142" gradientUnits="userSpaceOnUse"><stop stopColor="#92dff6" /><stop offset="1" stopColor="#4893bd" /></linearGradient>
        <linearGradient id={`${id}-paper`} x1="68" y1="32" x2="95" y2="108" gradientUnits="userSpaceOnUse"><stop stopColor="#fff" /><stop offset="1" stopColor="#d0e6f1" /></linearGradient>
      </defs>
      <ellipse cx="88" cy="143" rx="57" ry="7" fill="var(--shadow)" />
      <path d="M38 56a9 9 0 0 1 9-9h25l11 10h47a9 9 0 0 1 9 9v62H38V56Z" fill="#7bc4e4" stroke="#b5e6f7" />
      <g className="wm-discover-files">
        <rect x="64" y="33" width="48" height="70" rx="6" transform="rotate(-9 64 33)" fill={`url(#${id}-paper)`} stroke="#fff" />
        <path d="m70 56 24-4m-23 12 30-5m-28 13 20-4" stroke="#93b3c7" strokeWidth="3" strokeLinecap="round" />
        <rect x="89" y="42" width="43" height="62" rx="5" transform="rotate(8 89 42)" fill={`url(#${id}-paper)`} stroke="#fff" />
        <rect x="95" y="58" width="25" height="23" rx="3" transform="rotate(8 95 58)" fill="#b6dced" />
        <path d="m97 77 8-9 6 7 6-4 2 9" fill="#72a7c2" />
        <circle cx="113" cy="67" r="3" fill="#f8e9b6" />
      </g>
      <path d="M35 82a7 7 0 0 1 7-7h95a7 7 0 0 1 7 8l-7 47a10 10 0 0 1-10 9H48a10 10 0 0 1-10-9l-3-48Z" fill={`url(#${id}-folder)`} stroke="#c3efff" strokeOpacity=".8" />
      <path d="M42 82h94" stroke="#e2faff" strokeOpacity=".65" strokeWidth="2" strokeLinecap="round" />
      <g className="wm-fingerprint" stroke="#e2f8ff" strokeWidth="1.5" strokeLinecap="round" opacity=".8"><path d="M77 113v-6a10 10 0 0 1 20 0v6m-16 6v-12a6 6 0 0 1 12 0v13m-6-14v19m-10-5v5m20-5v5" /></g>
    </svg>
  );
}

function StorageIcon({ id }: { id: string }) {
  return (
    <svg className="wm-icon" viewBox="0 0 180 160" fill="none" aria-hidden="true">
      <defs><linearGradient id={`${id}-storage`} x1="52" y1="70" x2="130" y2="143" gradientUnits="userSpaceOnUse"><stop stopColor="#d5e4ef" /><stop offset="1" stopColor="#7b9cb7" /></linearGradient><linearGradient id={`${id}-asset`} x1="110" y1="18" x2="140" y2="74" gradientUnits="userSpaceOnUse"><stop stopColor="#fff" /><stop offset="1" stopColor="#b5dae9" /></linearGradient></defs>
      <ellipse cx="90" cy="143" rx="56" ry="7" fill="var(--shadow)" />
      <path d="M45 66 90 44l45 22v58l-45 22-45-22V66Z" fill={`url(#${id}-storage)`} stroke="#dfedf7" strokeOpacity=".8" />
      <path d="m45 66 45 22 45-22-45-22-45 22Z" fill="#d5e5ef" />
      <path d="M90 88v58" stroke="#e4f3ff" strokeOpacity=".65" />
      <path d="m55 73 24 12m-24-3 24 12" stroke="#f1faff" strokeWidth="2" strokeLinecap="round" opacity=".6" />
      <path d="m105 104 15-7v13l-15 7v-13Z" fill="#466d89" />
      <path d="m109 105 3 2 5-7" stroke="#d0f5e5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <g className="wm-upload-file"><path d="M111 17h21l10 10v35a5 5 0 0 1-5 5h-26a5 5 0 0 1-5-5V22a5 5 0 0 1 5-5Z" fill={`url(#${id}-asset)`} stroke="#fff" /><path d="M132 17v8a3 3 0 0 0 3 3h7" stroke="#fff" /><rect x="112" y="35" width="24" height="19" rx="3" fill="#91c6df" /><path d="m114 51 7-8 5 5 4-3 5 8" fill="#568fac" /><circle cx="130" cy="40" r="2.5" fill="#f9ecbf" /></g>
    </svg>
  );
}

function BuildIcon({ id }: { id: string }) {
  return (
    <svg className="wm-icon" viewBox="0 0 180 160" fill="none" aria-hidden="true">
      <defs><linearGradient id={`${id}-browser`} x1="39" y1="43" x2="143" y2="137" gradientUnits="userSpaceOnUse"><stop stopColor="#fff" /><stop offset="1" stopColor="#b9d6e8" /></linearGradient><linearGradient id={`${id}-picture`} x1="74" y1="70" x2="120" y2="117" gradientUnits="userSpaceOnUse"><stop stopColor="#c5edff" /><stop offset="1" stopColor="#82bbd6" /></linearGradient></defs>
      <ellipse cx="90" cy="143" rx="60" ry="7" fill="var(--shadow)" />
      <rect x="30" y="38" width="121" height="99" rx="12" fill={`url(#${id}-browser)`} stroke="#eef9ff" strokeWidth="1.5" />
      <path d="M31 62h119" stroke="#9ebed3" strokeOpacity=".4" />
      <circle cx="42" cy="50" r="3" fill="#ff6961" /><circle cx="52" cy="50" r="3" fill="#f7c453" /><circle cx="62" cy="50" r="3" fill="#6acb8c" />
      <rect x="76" y="46" width="63" height="8" rx="4" fill="#fff" fillOpacity=".7" />
      <rect x="40" y="71" width="19" height="55" rx="3" fill="#a3c4d8" fillOpacity=".35" />
      <g className="wm-build-picture"><rect x="69" y="72" width="70" height="47" rx="5" fill={`url(#${id}-picture)`} /><circle cx="121" cy="84" r="5" fill="#fff0c1" /><path d="m73 115 20-24 13 14 9-9 20 19" fill="#7eb2ca" /><path d="m73 115 19-13 16 13m0 0 14-13 13 13" fill="#4d8dab" /></g>
      <path d="M73 126h40" stroke="#84a8bd" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function WorkflowMotion() {
  const id = useId().replaceAll(":", "");
  return (
    <MotionScene
      className="wm-scene"
      label="Discover assets, migrate to configured storage, then transform production references"
      caption="Production builds use verified delivery records."
    >
      <div className="wm-composition">
        <div className="wm-connection wm-connection-one" aria-hidden="true"><span /></div>
        <div className="wm-connection wm-connection-two" aria-hidden="true"><span /></div>
        <div className="wm-stage wm-discover">
          <div className="wm-icon-wrap"><DiscoverIcon id={`${id}-discover`} /><DoneMark className="wm-mark-discover" /></div>
          <div className="wm-stage-copy"><span className="wm-step-name">01 · Discover</span><span className="wm-fingerprint-token"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 2-2 12m8-12-2 12M2 6h12M1 10h12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>SHA-256 fingerprint</span></div>
        </div>
        <div className="wm-stage wm-migrate">
          <div className="wm-icon-wrap"><StorageIcon id={`${id}-migrate`} /><DoneMark className="wm-mark-migrate" /></div>
          <div className="wm-stage-copy"><span className="wm-step-name">02 · Migrate</span><span className="wm-fingerprint-token"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 5h10v7H3V5Zm1-2h8v2M6 8l1.5 1.5L10 7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>Upload + verify</span></div>
        </div>
        <div className="wm-stage wm-transform">
          <div className="wm-icon-wrap"><BuildIcon id={`${id}-build`} /><DoneMark className="wm-mark-build" /></div>
          <div className="wm-stage-copy"><span className="wm-step-name">03 · Transform</span><span className="wm-fingerprint-token"><svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 5 3 3-3 3m5 0h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>Production build</span></div>
        </div>
      </div>
    </MotionScene>
  );
}
