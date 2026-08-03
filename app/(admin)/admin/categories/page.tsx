// Destination : app/admin/categories/page.tsx

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../actions";
import { CategoriesClient } from "./CategoriesClient";

export default async function AdminCategoriesPage() {
  await requireAdmin();

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: {
          products: { where: { archived: false } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Catégories</h1>
        <p className="text-sm text-[var(--color-muted)]">
          {categories.length} catégorie{categories.length > 1 ? "s" : ""}
        </p>
      </div>

      <CategoriesClient
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          productCount: c._count.products,
        }))}
      />
    </div>
  );
}
