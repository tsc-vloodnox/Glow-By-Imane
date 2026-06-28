// Destination : app/(shop)/page.tsx
import { prisma } from "@/lib/prisma";
import { ShopPageClient } from "./components/ShopPageClient";

export default async function ShopPage() {
  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      include: { category: true },
      orderBy: [{ createdAt: "desc" }],
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <ShopPageClient
      products={products}
      categories={categories.map((category) => ({ id: category.id, label: category.name }))}
    />
  );
}
