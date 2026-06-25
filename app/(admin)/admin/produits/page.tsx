import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../actions";
import { AdminProductsTable } from "./AdminProductsTable";

// URL publique du bucket Supabase Storage
// → à déclarer dans .env.local : NEXT_PUBLIC_SUPABASE_STORAGE_URL=https://xxx.supabase.co/storage/v1/object/public/catalogue
const STORAGE_BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL ?? "";

export default async function AdminProduitsPage() {
  await requireAdmin();

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      orderBy: [{ archived: "asc" }, { createdAt: "desc" }],
      include: {
        category: { select: { id: true, name: true } },
        _count: { select: { orderItems: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Produits</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {products.filter((p) => !p.archived).length} actif
            {products.filter((p) => !p.archived).length !== 1 ? "s" : ""}
            {products.filter((p) => p.archived).length > 0 &&
              ` · ${products.filter((p) => p.archived).length} archivé${products.filter((p) => p.archived).length > 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href="/admin/produits/new"
          className="rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white"
        >
          + Nouveau produit
        </Link>
      </div>

      <AdminProductsTable
        initialProducts={products}
        categories={categories}
        storageBaseUrl={STORAGE_BASE_URL}
      />
    </div>
  );
}
