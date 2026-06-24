import HomePageClient from "./HomePageClient";
import { prisma } from "@/lib/prisma";

const MAX_HOME_PRODUCTS = 8;

export default async function HomePage() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      where: { favorite: true },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: MAX_HOME_PRODUCTS,
    }),
    prisma.product.count({ where: { favorite: true } }),
  ]);

  const categoryItems = [
    { id: "all", label: "Tout" },
    ...categories.map((category) => ({ id: category.id, label: category.name })),
  ];

  return (
    <HomePageClient products={products} categories={categoryItems} totalCount={totalCount} />
  );
}
