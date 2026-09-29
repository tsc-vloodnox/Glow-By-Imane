// Destination : lib/restock.ts
// Quantités à réapprovisionner : stock négatif laissé par les commandes en gros
// confirmées au-delà du disponible.

import { prisma } from "@/lib/prisma";

export type RestockNeed = { key: string; productId: string; label: string; missing: number };

export async function getRestockNeeds(): Promise<RestockNeed[]> {
  const [products, sizes] = await Promise.all([
    prisma.product.findMany({
      where: { stock: { lt: 0 } },
      select: { id: true, name: true, stock: true },
    }),
    prisma.productSize.findMany({
      where: { stock: { lt: 0 } },
      select: { id: true, label: true, stock: true, product: { select: { id: true, name: true } } },
    }),
  ]);

  return [
    ...products.map((p) => ({ key: p.id, productId: p.id, label: p.name, missing: -p.stock })),
    ...sizes.map((s) => ({
      key: `${s.product.id}:${s.id}`,
      productId: s.product.id,
      label: `${s.product.name} — ${s.label}`,
      missing: -s.stock,
    })),
  ].sort((a, b) => b.missing - a.missing);
}
