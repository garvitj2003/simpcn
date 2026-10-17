"use client";

import { useState } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/shared/button";
import { CodeBlock } from "@/components/shared/code-block";
import { packageManagers, initCommand, type PackageManager } from "@/lib/package-managers";
import "./compatibility-section.css";

const integrations = {
  next: {
    name: "Next.js",
    version: "16.4 · webpack + Turbopack",
    filename: "next.config.ts",
    config: "import { withSimpcn } from '@simpcn/next';\n\nconst nextConfig = {\n  // Keep existing Next.js settings here.\n};\n\nexport default withSimpcn(nextConfig);",
    note: "Static media references and verified static next/image sources are supported. Next.js CSS references stay local.",
    docs: "/docs/nextjs",
  },
  vite: {
    name: "Vite",
    version: "8 · React, HTML + bundled CSS",
    filename: "vite.config.ts",
    config: "import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\nimport { simpcn } from '@simpcn/vite';\n\nexport default defineConfig({\n  plugins: [simpcn(), react()],\n});",
    note: "Place simpcn() before JSX compilation plugins. Vue and Svelte templates are not automatically rewritten.",
    docs: "/docs/vite",
  },
  expo: {
    name: "React Native",
    version: "Expo 58 · iOS + Android · experimental",
    filename: "metro.config.js",
    config: "const { getDefaultConfig } = require('expo/metro-config');\nconst { withSimpcn } = require('@simpcn/expo/metro');\n\nmodule.exports = withSimpcn(\n  getDefaultConfig(__dirname)\n);",
    note: "Static PNG/JPEG imports and require(), iOS/Android families, and @2x/@3x densities. Device, EAS, and OTA validation remain.",
    docs: "/docs/react-native-expo",
  },
} as const;

export function CompatibilitySection() {
  const [framework, setFramework] = useState<keyof typeof integrations>("next");
  const [manager, setManager] = useState<PackageManager>("npm");
  const integration = integrations[framework];
  const command = initCommand(manager, framework);

  return (
    <section className="compatibility-section" id="get-started" aria-labelledby="compatibility-title">
      <div className="compatibility-layout">
        <div className="compatibility-guidance">
          <div className="compatibility-heading">
            <h2 id="compatibility-title">Fits right into<br />the existing build.</h2>
            <p>Keep the framework. Add Simpcn to the configuration.</p>
          </div>

          <div className="compatibility-frameworks" role="group" aria-label="Choose a framework">
            {Object.entries(integrations).map(([key, value]) => (
              <button key={key} type="button" aria-pressed={framework === key} aria-controls="compatibility-integration" onClick={() => setFramework(key as keyof typeof integrations)}>{value.name}</button>
            ))}
          </div>
          {framework === "expo" && <p className="compatibility-status">React Native with Expo is experimental.</p>}
          <p className="compatibility-version">{integration.version}</p>
          <p className="compatibility-note">{integration.note}</p>
          <Link className="compatibility-text-link" href={integration.docs}>Read the {integration.name} guide <span aria-hidden="true">↗</span></Link>


        </div>

        <div className="compatibility-editor" id="compatibility-integration">
          <p className="compatibility-editor-intro">Already installed? Initialize the project, then update the framework config.</p>
          <div className="compatibility-package-managers" role="group" aria-label="Choose a package manager for setup">
            {(Object.keys(packageManagers) as PackageManager[]).map(name => <button key={name} type="button" aria-pressed={manager === name} aria-controls="compatibility-command" onClick={() => setManager(name)}>{name}</button>)}
          </div>
          <div id="compatibility-command"><CodeBlock code={command} label={`${manager} · initialize`} language="sh" /></div>
          <CodeBlock code={integration.config} label={integration.filename} language="ts" />
          <p className="compatibility-editor-note">{framework === "expo" ? "Init defaults to assets/cdn and prints immutable release-prefix guidance. Init can install the adapter using your project’s package manager." : "Init creates the storage configuration and can install the adapter. Framework configuration stays explicit."}</p>
        </div>

          <div className="compatibility-storage">
            <h3>The storage stays under control.</h3>
            <p>Connect an existing bucket and its public delivery URL. Credentials stay outside the client bundle.</p>
            <Link className="compatibility-text-link" href="/docs/storage">Configure storage <span aria-hidden="true">↗</span></Link>
          </div>
      </div>

      <div className="compatibility-finish">
        <div>
          <h3>Then preview, migrate, build.</h3>
          <p>Upload and verify assets before the production build. Source files stay in place.</p>
        </div>
        <ButtonLink href="/docs" variant="secondary" className="compatibility-desktop-cta">Follow the setup guide <span aria-hidden="true">↗</span></ButtonLink>
        <ButtonLink href={integration.docs} variant="secondary" className="compatibility-mobile-cta">Set up {integration.name} <span aria-hidden="true">↗</span></ButtonLink>
      </div>
      <div className="compatibility-requirements">
        <span>Requires Node.js 24.11+</span>
        <a href="https://www.npmjs.com/package/simpcn">Available on npm <span aria-hidden="true">↗</span></a>
      </div>
    </section>
  );
}
