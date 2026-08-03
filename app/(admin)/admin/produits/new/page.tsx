import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { withDatabaseFallback } from "@/lib/db";
import { ProductForm } from "../ProductForm";
import { requireAdmin } from "../../actions";

const STORAGE_BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL ?? "";

export default async function NewProductPage() {
  await requireAdmin();

  const categories = await withDatabaseFallback(
    () => prisma.category.findMany({ orderBy: { name: "asc" } }),
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Nouveau produit</h1>
          <p className="text-sm text-[var(--color-muted)]">Ajoutez un produit et ses images.</p>
        </div>
        <Link href="/admin/produits" className="text-sm text-[var(--color-accent)]">Retour</Link>
      </div>

      <ProductForm categories={categories} storageBaseUrl={STORAGE_BASE_URL} />
    </div>
  );
}
