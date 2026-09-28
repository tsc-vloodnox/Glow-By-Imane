// Destination : app/sitemap.ts
// Servi automatiquement sur https://glowbyimane.com/sitemap.xml

import type { MetadataRoute } from "next";

import { prisma } from "@/lib/prisma";

const BASE_URL = "https://glowbyimane.com";

// Régénéré au plus une fois par heure (nouveaux produits/kits)
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, kits] = await Promise.all([
    prisma.product.findMany({
      where: { archived: false },
      select: { slug: true, updatedAt: true },
    }),
    prisma.kit.findMany({
      where: { archived: false },
      select: { id: true, createdAt: true },
    }),
  ]);

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${BASE_URL}/kits`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...products.map((product) => ({
      url: `${BASE_URL}/produits/${product.slug}`,
      lastModified: product.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...kits.map((kit) => ({
      url: `${BASE_URL}/kits/${kit.id}`,
      lastModified: kit.createdAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
