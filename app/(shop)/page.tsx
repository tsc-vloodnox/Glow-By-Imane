// Destination : app/(shop)/page.tsx
import { prisma } from "@/lib/prisma";
import { ShopPageClient } from "./components/ShopPageClient";

export default async function ShopPage() {
  const [products, categories, kits] = await Promise.all([
    prisma.product.findMany({
      where: { archived: false },
      include: {
        category: true,
        sizes: { where: { archived: false }, orderBy: { position: "asc" } },
        packPrices: true,
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