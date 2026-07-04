import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { withDatabaseFallback } from "@/lib/db";
import { KitForm } from "../KitForm";
import { requireAdmin } from "../../actions";

const STORAGE_BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL ?? "";

export default async function NewKitPage() {
  await requireAdmin();

  const products = await withDatabaseFallback(
    () =>
      prisma.product.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          price: true,
          archived: true,
          sizes: {
            where: { archived: false },
            orderBy: { position: "asc" },
            select: { id: true, label: true, price: true },
          },
        },
      }),
    [],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Nouveau kit</h1>
          <p className="text-sm text-[var(--color-muted)]">Composez un kit à partir des produits existants.</p>
        </div>
        <Link href="/admin/kits" className="text-sm text-[var(--color-accent)]">Retour</Link>
      </div>

      <KitForm products={products} storageBaseUrl={STORAGE_BASE_URL} />
    </div>
  );
}
