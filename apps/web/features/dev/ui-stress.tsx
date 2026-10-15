"use client";

import { useState, useSyncExternalStore } from "react";
import { CodeBlock } from "@/components/shared/code-block";
import { ButtonLink } from "@/components/shared/button";
import { SourceReference } from "@/components/hero/source-reference";
import { ThemeToggle } from "@/components/navigation/theme-toggle";
import "@/components/hero/delivery-demo.css";
import "./ui-stress.css";

const fixtures = {
  demo: {
    label: "next.config.ts",
    code: "import { withSimpcn } from '@simpcn/next';\n\nexport default withSimpcn({});",
    action: "Read the setup guide",
    output: "https://cdn.example.com/assets/window.svg",
  },
  worst: {
    label: "next.config.production-international-preview.ts · existing framework configuration",
    code: 'export function Preview() {\n  return <img src="/images/product-launch/IMG_20250914_183022_HDR_portrait_edited_edited.HEIC" alt="Đặng Thị Ngọc Hân — aperçu du produit" />;\n}',
    action: "Read the production integration and storage configuration guide",
    output: "https://cdn.example.com/workspaces/acme/projects/q3-launch/assets/9f8e7d6c5b4a/hero-desktop-international.webp?version=2026-10-15#preview",
  },
  empty: { label: "Empty snippet", code: "", action: "Docs", output: "" },
} as const;
type Dataset = keyof typeof fixtures;

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}
function snapshot(): Dataset {
  const value = new URLSearchParams(window.location.search).get("data");
  return value === "worst" || value === "empty" ? value : "demo";
}
const serverSnapshot = (): Dataset => "demo";

export function UiStress() {
  const dataset = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [narrow, setNarrow] = useState(false);
  const fixture = fixtures[dataset];
  function select(value: Dataset) {
    const url = new URL(window.location.href);
    url.searchParams.set("data", value);
    window.history.replaceState(null, "", url);
    window.dispatchEvent(new Event("popstate"));
  }
  return <main className="ui-stress">
    <header className="ui-stress-heading">
      <h1>UI stress fixtures</h1>
      <p>Development only. Real components, realistic long filenames and delivery URLs. Use browser zoom and a phone to review touch and text scaling.</p>
      <div className="ui-stress-tools"><button type="button" aria-pressed={narrow} onClick={() => setNarrow(value => !value)}>{narrow ? "280px container" : "320px container"}</button><ThemeToggle /></div>
    </header>
    <div className="ui-stress-surface" style={{ maxWidth: narrow ? 280 : 320 }}>
      <CodeBlock label={fixture.label} code={fixture.code} language="tsx" />
      <ButtonLink href="/docs">{fixture.action}<span aria-hidden="true">↗</span></ButtonLink>
      <SourceReference />
      <CodeBlock label="Production asset URL" code={fixture.output} />
    </div>
    <div className="ui-stress-switch" role="group" aria-label="Stress fixture dataset">
      {(["demo", "worst", "empty"] as const).map(value => <button type="button" key={value} aria-pressed={dataset === value} onClick={() => select(value)}>{value === "demo" ? "Demo data" : value === "worst" ? "Worst case" : "Empty"}</button>)}
    </div>
  </main>;
}
