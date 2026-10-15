"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { CodeBlock } from "@/components/shared/code-block";

const commands = {
  npm: { install: "npm i -D simpcn", exec: "npx", build: "npm run build" },
  pnpm: { install: "pnpm add -D simpcn", exec: "pnpm exec", build: "pnpm run build" },
  bun: { install: "bun add -d simpcn", exec: "bun run", build: "bun run build" },
  yarn: { install: "yarn add -D simpcn", exec: "yarn run", build: "yarn run build" },
} as const;
type Manager = keyof typeof commands;
const PackageManagerContext = createContext<{ manager: Manager; select: (manager: Manager) => void } | null>(null);

export function PackageManagerProvider({ children }: { children: ReactNode }) {
  const [manager, select] = useState<Manager>("npm");
  return <PackageManagerContext.Provider value={{ manager, select }}>{children}</PackageManagerContext.Provider>;
}

function usePackageManager() {
  const context = useContext(PackageManagerContext);
  if (!context) throw new Error("Documentation commands require PackageManagerProvider.");
  return context;
}

export function InstallCommand() {
  const { manager, select } = usePackageManager();
  return <div className="docs-install-command">
    <div className="docs-package-managers" role="group" aria-label="Choose a package manager">
      {(Object.keys(commands) as Manager[]).map(name => <button key={name} type="button" aria-pressed={manager === name} aria-controls="docs-install-output docs-command-init docs-command-workflow" onClick={() => select(name)}>{name}</button>)}
    </div>
    <div id="docs-install-output"><CodeBlock key={manager} code={commands[manager].install} label="Install as a dev dependency" language="sh" /></div>
    <span className="sr-only" role="status">Commands use {manager}.</span>
  </div>;
}

export function PackageCommand({ action, framework }: { action: "init" | "workflow"; framework?: "next" | "vite" }) {
  const { manager } = usePackageManager();
  const runner = `${commands[manager].exec} simpcn`;
  const code = action === "init" ? `${runner} init${framework ? ` --framework ${framework}` : ""}` : `${runner} plan\n${runner} migrate\n${commands[manager].build}`;
  return <div id={`docs-command-${action}`}><CodeBlock key={`${manager}-${action}`} code={code} label={action === "init" ? `${manager} · initialize` : `${manager} · preview, migrate, build`} language="sh" /></div>;
}
