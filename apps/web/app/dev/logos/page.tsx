import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LogoExploration } from "@/features/dev/logo-exploration";

export const metadata: Metadata = {
  title: "Simpcn logo directions",
  robots: { index: false, follow: false },
};

export default function LogoDirectionsPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <LogoExploration />;
}
