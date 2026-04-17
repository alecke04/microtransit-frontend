import "@/styles/globals.css";

import type { Metadata } from "next";
import type { Viewport } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: 'MicroTransit - Florida Polytechnic University',
  description: 'Real-time transit tracking for Florida Polytechnic University',
  icons: {
    icon: '/cropped-cropped-FLPolyMarkLogo_Browser-192x192.webp',
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Root layout wraps all pages. Keep this file simple and global.
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
