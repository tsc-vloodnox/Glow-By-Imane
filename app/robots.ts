// Destination : app/robots.ts
// Servi automatiquement sur https://glowbyimane.com/robots.txt

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin/", "/api/", "/cadeau/"],
      },
    ],
    sitemap: "https://glowbyimane.com/sitemap.xml",
  };
}
