"use client";

import { useSyncExternalStore } from "react";

const key = "simpcn-theme";
function subscribe(callback: () => void) {
  window.addEventListener("simpcn-theme-change", callback);
  return () => window.removeEventListener("simpcn-theme-change", callback);
}
const getTheme = () => document.documentElement.dataset.theme ?? "light";
const getServerTheme = () => "light";

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getTheme, getServerTheme);
  const dark = theme === "dark";
  function toggle() {
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => { meta.content = next === "dark" ? "#181818" : "#faf8f5"; });
    try { localStorage.setItem(key, next); } catch { /* The current tab can still change theme. */ }
    window.dispatchEvent(new Event("simpcn-theme-change"));
  }
  return <button className="theme-toggle" type="button" onClick={toggle} aria-label={dark ? "Switch to light theme" : "Switch to dark theme"} title={dark ? "Switch to light theme" : "Switch to dark theme"}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dark ? <><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></> : <path d="M20.5 13.5A8.5 8.5 0 0 1 10.5 3a8.5 8.5 0 1 0 10 10.5Z" />}
    </svg>
  </button>;
}

