// Destination : app/admin/promotions/page.tsx

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../actions";
import { PromotionsClient } from "./PromotionsClient";

export default async function AdminPromotionsPage() {
  await requireAdmin();

  const now = new Date();

  const [promotions, products] = await Promise.all([
    prisma.promotion.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        products: {
          include: {
            product: { select: { id: true, name: true, price: true } },
          },
        },
      },
    }),
    prisma.product.findMany({
      where: { archived: false },
      orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        price: true,
        category: { select: { name: true } },
      },
    }),
  ]);

  // Calcule le statut de chaque promotion pour l'affichage
  const enriched = promotions.map((promo) => ({
    ...promo,
    status:
      !promo.active
        ? "inactive" as const
        : now < promo.startAt
        ? "scheduled" as const
        : now > promo.endAt
        ? "expired" as const
        : "active" as const,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Promotions</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Gérez les remises temporaires sur vos produits
        </p>
      </div>

      <PromotionsClient
        promotions={enriched}
        allProducts={products.map((p) => ({
          id: p.id,
          name: p.name,
          price: p.price,
          categoryName: p.category.name,
        }))}
      />
    </div>
  );
}
