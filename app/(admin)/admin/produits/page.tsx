import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { withDatabaseFallback } from "@/lib/db";
import { requireAdmin } from "./actions";
import { AdminProductsTable } from "./AdminProductsTable";

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  await requireAdmin();

  const { category } = await searchParams;

  const [products, categories] = await withDatabaseFallback(
    async () => {
      const [productList, categoryList] = await Promise.all([
        prisma.product.findMany({
          where: category && category !== "all" ? { categoryId: category } : undefined,
          include: { category: true },
          orderBy: { createdAt: "desc" },
        }),
        prisma.category.findMany({ orderBy: { name: "asc" } }),
      ]);

      return [productList, categoryList] as const;
    },
    [[], [] as Array<{ id: string; name: string }>],
  );

  const safeCategories = Array.isArray(categories) ? categories : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Produits</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {products.length} produit{products.length > 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <form method="get" className="flex items-center gap-2">
            <select
              name="category"
              defaultValue={category ?? "all"}
              className="rounded-full border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
            >
              <option value="all">Toutes les catégories</option>
              {safeCategories.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-full border border-[var(--color-border)] bg-white px-3 py-2 text-sm">
              Filtrer
            </button>
          </form>

          <Link href="/admin/produits/new" className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white">
            + Ajouter
          </Link>
        </div>
      </div>

      <AdminProductsTable
        initialProducts={products.map((product) => ({
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          stock: product.stock,
          favorite: product.favorite,
          categoryId: product.categoryId,
          category: product.category,
        }))}
        categories={safeCategories}
      />
    </div>
  );
}
