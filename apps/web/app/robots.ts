import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/site-config";
export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();
  return { rules: { userAgent: "*", allow: "/" }, ...(origin ? { sitemap: new URL("/sitemap.xml", origin).href } : {}) };
}
