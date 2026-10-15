import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UiStress } from "@/features/dev/ui-stress";

export const metadata: Metadata = {
  title: "UI stress fixtures",
  robots: { index: false, follow: false },
};

export default function UiStressPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <UiStress />;
}
