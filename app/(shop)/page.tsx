// Destination : app/(shop)/page.tsx
import { prisma } from "@/lib/prisma";
import { ShopPageClient } from "./components/ShopPageClient";

// Régénère la page au plus toutes les 60 s : les promotions démarrent/expirent
// à l'heure prévue et le stock reste frais, sans attendre une action admin.
export const revalidate = 60;

export default async function ShopPage() {
  // Calculé à chaque rendu (et non au chargement du module, où il restait figé)
  const now = new Date();
  const activePromoWhere = {
    promotion: {
      active: true,
      startAt: { lte: now },
      endAt: { gte: now },
    },
  };

  const [products, categories, kits] = await Promise.all([
    prisma.product.findMany({
      where: { archived: false },
      include: {
        category: true,
        sizes: { where: { archived: false }, orderBy: { position: "asc" } },
        packPrices: true,
        promotions: {
          where: activePromoWhere,
          include: { promotion: { select: { discountPercent: true } } },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.kit.findMany({
      where: { archived: false },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, stock: true } },
            productSize: { select: { id: true, label: true, stock: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return (
    <ShopPageClient
      products={products}
      categories={categories.map((category) => ({ id: category.id, label: category.name }))}
      kits={kits}
    />
  );
}
