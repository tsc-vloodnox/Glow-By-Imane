// Destination : app/manifest.ts
// Servi automatiquement sur https://glowbyimane.com/manifest.webmanifest

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Glow by Imane",
    short_name: "Glow by Imane",
    description: "Boutique beauté & accessoires à Conakry. Paiement à la livraison.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF7F4",
    theme_color: "#8B1A3A", 
    orientation: "portrait",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      }
    ],
  };
}
