"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./button";
import "./code-block.css";

export function CodeBlock({ code, label = "Code", language }: { code: string; label?: string; language?: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(code);
      setStatus("copied");
      timer.current = setTimeout(() => setStatus("idle"), 2200);
    } catch { setStatus("error"); }
  }
  return <div className="site-code-block">
    <div className="site-code-bar"><span>{label}</span><Button variant="washed" size="sm" className="site-code-copy" onClick={copy} aria-label={status === "copied" ? `${label} copied` : `Copy ${label}`}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">{status === "copied" ? <path d="m5 12 4 4L19 6" /> : <><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V4H4v12h4" /></>}</svg>{status === "copied" ? "Copied" : "Copy"}
    </Button></div>
    <pre tabIndex={0} aria-label={label}><code className={language ? `language-${language}` : undefined}>{code}</code></pre>
    <span className="sr-only" role="status">{status === "copied" ? `${label} copied to clipboard.` : status === "error" ? "Clipboard unavailable. Select the code to copy it manually." : ""}</span>
    {status === "error" && <p className="site-code-error">Select and copy the code above; clipboard access is unavailable.</p>}
  </div>;
}
