import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SerwistProvider } from "@serwist/turbopack/react";
import { PwaOfflineBanner } from "@/components/pwa/pwa-offline-banner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pacho Motos",
  description: "Sistema de gestión del taller de motos",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icon-512x512.png",
    apple: "/icon-192x192.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "Pacho Motos",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <SerwistProvider swUrl="/serwist/sw.js" disable={process.env.NEXT_PUBLIC_ENABLE_SW !== "true"}>
          <PwaOfflineBanner />
          {children}
        </SerwistProvider>
      </body>
    </html>
  );
}
