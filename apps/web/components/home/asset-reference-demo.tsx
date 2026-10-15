"use client";

import { useState } from "react";
import Link from "next/link";
import { CodeBlock } from "@/components/shared/code-block";
import { ReferenceMotion } from "@/components/motion/reference-motion";
import "./asset-reference-demo.css";

const environments = {
  development: {
    name: "Development",
    destination: "Served from the local public/ directory",
  },
  production: {
    name: "Production",
    destination: "Delivered from the configured CDN URL",
  },
} as const;

export function AssetReferenceDemo() {
  const [environment, setEnvironment] = useState<keyof typeof environments>("production");

  return (
    <section className="asset-reference-demo" id="asset-demo" aria-labelledby="asset-reference-title">
      <div className="asset-reference-heading">
        <p className="asset-reference-eyebrow">One reference. Two environments.</p>
        <h2 id="asset-reference-title">Same component. New destination.</h2>
        <p>Switch environments. The source stays the same.</p>
      </div>

      <div className="asset-reference-environments" role="group" aria-label="Select the output environment">
        {Object.entries(environments).map(([key, value]) => (
          <button type="button" key={key} aria-pressed={environment === key} aria-controls="asset-reference-result" onClick={() => setEnvironment(key as keyof typeof environments)}>{value.name}</button>
        ))}
      </div>
      <div id="asset-reference-result">
        <ReferenceMotion key={environment} production={environment === "production"} />
        <p className="asset-reference-destination" role="status">{environments[environment].destination}</p>
      </div>
      <details className="asset-reference-context">
        <summary>Example configuration and requirements</summary>
        <div className="asset-reference-context-content">
          <CodeBlock code={"publicBaseUrl: 'https://cdn.example.com/assets/'"} label="simpcn.config.ts · delivery URL" language="ts" />
          <p>The storage prefix is <code>assets</code>; the URL includes it once. Production requires a deployment record verified against the current asset bytes. The CDN domain shown here is illustrative.</p>
          <Link href="/docs/supported-references">Supported references and limitations <span aria-hidden="true">↗</span></Link>
        </div>
      </details>
    </section>
  );
}
