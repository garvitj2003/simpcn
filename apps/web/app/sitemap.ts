import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site-config";
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  if (!origin) return [];
  return ["/", "/docs", "/docs/nextjs", "/docs/vite", "/docs/react-native-expo", "/docs/storage", "/docs/cli", "/docs/supported-references", "/docs/limitations", "/docs/troubleshooting"].map(path => ({ url: new URL(path, origin).href, changeFrequency: "monthly", priority: path === "/" ? 1 : path === "/docs" ? 0.9 : 0.7 }));
}
