import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../actions";
import { AdminKitsTable } from "./AdminKitsTable";

const STORAGE_BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL ?? "";

export default async function AdminKitsPage() {
  await requireAdmin();

  const [kits, products] = await Promise.all([
    prisma.kit.findMany({
      orderBy: [{ archived: "asc" }, { createdAt: "desc" }],
      include: {
        items: {
          select: { id: true, productId: true, productSizeId: true, quantity: true },
        },
        _count: { select: { orderItems: true } },
      },
    }),
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
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Kits</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {kits.filter((k) => !k.archived).length} actif
            {kits.filter((k) => !k.archived).length !== 1 ? "s" : ""}
            {kits.filter((k) => k.archived).length > 0 &&
              ` · ${kits.filter((k) => k.archived).length} archivé${kits.filter((k) => k.archived).length > 1 ? "s" : ""}`}
          </p>
        </div>
        <Link
          href="/admin/kits/new"
          className="rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white"
        >
          + Nouveau kit
        </Link>
      </div>

      <AdminKitsTable
        initialKits={kits}
        products={products}
        storageBaseUrl={STORAGE_BASE_URL}
      />
    </div>
  );
}
