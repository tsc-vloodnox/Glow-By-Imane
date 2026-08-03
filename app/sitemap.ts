// Destination : app/sitemap.ts
// Servi automatiquement sur https://glowbyimane.com/sitemap.xml

import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";

const BASE_URL = "https://glowbyimane.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await prisma.product.findMany({
    where: { archived: false },
    select: { id: true, updatedAt: true },
  });

  const productUrls = products.map((product) => ({
    url: `${BASE_URL}/produits/${product.id}`,
    lastModified: product.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    ...productUrls,
  ];
}
