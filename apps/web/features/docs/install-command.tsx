"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { CodeBlock } from "@/components/shared/code-block";

import { packageManagers as commands, initCommand, workflowCommand, type PackageManager as Manager, type Framework } from '@/lib/package-managers';
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

export function InstallCommand({ packages = ["simpcn"], label = "Install as a dev dependency" }: { packages?: readonly string[]; label?: string }) {
  const { manager, select } = usePackageManager();
  return <div className="docs-install-command">
    <div className="docs-package-managers" role="group" aria-label="Choose a package manager">
      {(Object.keys(commands) as Manager[]).map(name => <button key={name} type="button" aria-pressed={manager === name} aria-controls="docs-install-output docs-command-init docs-command-workflow" onClick={() => select(name)}>{name}</button>)}
    </div>
    <div id="docs-install-output"><CodeBlock key={manager} code={`${commands[manager].add} ${packages.join(" ")}`} label={label} language="sh" /></div>
    <span className="sr-only" role="status">Commands use {manager}.</span>
  </div>;
}

export function PackageCommand({ action, framework, integrationPackage }: { action: "init" | "workflow"; framework?: Framework; integrationPackage?: string }) {
  const { manager } = usePackageManager();
  const code = action === "init" ? initCommand(manager, framework, integrationPackage) : workflowCommand(manager, framework);
  return <div id={`docs-command-${action}`}><CodeBlock key={`${manager}-${action}`} code={code} label={action === "init" ? `${manager} · initialize` : `${manager} · preview, migrate, ${framework === "expo" ? "export" : "build"}`} language="sh" /></div>;
}
