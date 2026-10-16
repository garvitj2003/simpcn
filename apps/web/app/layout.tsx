import type { Metadata, Viewport } from "next";
import { Caveat, Geist, Geist_Mono } from "next/font/google";
import "@/styles/globals.css";
import "@/styles/theme.css";
import { themeScript } from "@/components/navigation/theme-script";
import { siteOrigin } from "@/lib/site-config";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const headlineFont = Caveat({
  variable: "--font-headline",
  subsets: ["latin"],
  weight: "600",
  display: "swap",
});

const socialPreview = {
  url: "/social-preview-v2.jpg",
  width: 1200,
  height: 780,
  type: "image/jpeg",
  alt: "Simpcn landing page — Your code stays the same. The assets move to CDN.",
};

export const metadata: Metadata = {
  metadataBase: siteOrigin(),
  applicationName: "Simpcn",
  alternates: siteOrigin() ? { canonical: "/" } : undefined,
  openGraph: { title: "Simpcn — Same source. CDN delivery.", description: "Move public assets to CDN-backed storage. Keep source code unchanged and development local, with Next.js and Vite integrations.", siteName: "Simpcn", type: "website", locale: "en_US", images: [socialPreview] },
  twitter: { card: "summary_large_image", title: "Simpcn — Same source. CDN delivery.", description: "Supported asset references move to the CDN during production builds. Source stays the same.", images: [socialPreview] },
  robots: { index: true, follow: true },
  title: "Simpcn — Your code stays the same. The assets move to CDN.",
  description: "Move public assets to CDN-backed storage. Simpcn rewrites supported production asset references for Next.js and Vite while keeping development local.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#faf8f5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${headlineFont.variable} h-full antialiased`}
    >
      <head><script id="simpcn-theme" dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
