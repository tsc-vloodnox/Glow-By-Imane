// Destination : app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display, Geist } from "next/font/google";

import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const display = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://glowbyimane.com"),

  title: {
    default: "Glow by Imane — Beauté & Accessoires à Conakry",
    template: "%s | Glow by Imane",
  },
  description:
    "Boutique beauté et accessoires à Conakry. Commandez en ligne, payez à la livraison. Soins, parfums, sacs et bien plus.",

  keywords: [
    "beauté Conakry",
    "accessoires Guinée",
    "boutique en ligne Guinée",
    "cosmétiques Conakry",
    "livraison Conakry",
  ],

  openGraph: {
    title: "Glow by Imane — Beauté & Accessoires à Conakry",
    description:
      "Parcourez notre catalogue et commandez via WhatsApp. Paiement à la livraison.",
    url: "https://glowbyimane.com",
    siteName: "Glow by Imane",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Glow by Imane — Beauté & Accessoires",
      },
    ],
    locale: "fr_GN",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Glow by Imane — Beauté & Accessoires",
    description: "Boutique en ligne à Conakry. Paiement à la livraison.",
    images: ["/og-image.jpg"],
  },

  robots: {
    index: true,
    follow: true,
  },

  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#8B1A3A",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={cn(
        "h-full",
        "antialiased",
        display.variable,
        body.variable,
        "font-sans",
        geist.variable,
      )}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}