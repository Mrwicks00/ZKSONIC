import type React from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { Analytics } from "@vercel/analytics/next";
import { Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import dynamic from "next/dynamic";

const Providers = dynamic(
  () =>
    import("@/components/providers").then((mod) => ({
      default: mod.Providers,
    })),
  {
    ssr: false,
  }
);
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZKSONIC - ZKP-Enabled Decentralized Identity",
  description:
    "Zero-Knowledge Proof enabled decentralized identity management on Sonic Testnet",
  generator: "v0.app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`font-sans ${GeistSans.variable} ${GeistMono.variable} antialiased`}
      >
        <Providers>
          <Suspense fallback={null}>{children}</Suspense>
          <Toaster />
          <Analytics />
        </Providers>
      </body>
    </html>
  );
}
