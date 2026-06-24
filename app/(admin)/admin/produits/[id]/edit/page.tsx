import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { withDatabaseFallback } from "@/lib/db";
import { ProductForm } from "../../ProductForm";
import { requireAdmin } from "../../actions";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();

  const { id } = await params;

  const [product, categories] = await withDatabaseFallback(
    async () => {
      const [productItem, categoryList] = await Promise.all([
        prisma.product.findUnique({ where: { id } }),
        prisma.category.findMany({ orderBy: { name: "asc" } }),
      ]);

      return [productItem, categoryList] as const;
    },
    [null, [] as Array<{ id: string; name: string }>],
  );

  if (!product) {
    return <p className="text-sm text-[var(--color-muted)]">Produit introuvable.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Modifier le produit</h1>
          <p className="text-sm text-[var(--color-muted)]">Mettez à jour les informations et les images.</p>
        </div>
        <Link href="/admin/produits" className="text-sm text-[var(--color-accent)]">Retour</Link>
      </div>

      <ProductForm
        categories={categories}
        product={{
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          stock: product.stock,
          favorite: product.favorite,
          images: product.images,
          categoryId: product.categoryId,
        }}
      />
    </div>
  );
}
