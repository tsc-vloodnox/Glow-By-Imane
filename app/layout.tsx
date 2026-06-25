import type { Metadata } from "next";
import { Inter, Playfair_Display, Geist } from "next/font/google";

import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const display = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Glow by Imane — Beauté & Accessoires",
  description:
    "Boutique beauté et accessoires. Découvrez, discutez, commandez en toute confiance.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={cn("h-full", "antialiased", display.variable, body.variable, "font-sans", geist.variable)}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
