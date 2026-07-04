import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../actions";
import { AdminLivreursTable } from "./AdminLivreursTable";

export default async function AdminLivreursPage() {
  await requireAdmin();

  const livreurs = await prisma.livreur.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      phone: true,
      notes: true,
      active: true,
      _count: {
        select: {
          deliveries: { where: { status: { in: ["PLANIFIEE", "EN_COURS"] } } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Livreurs</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {livreurs.filter((l) => l.active).length} actif
            {livreurs.filter((l) => l.active).length !== 1 ? "s" : ""}
          </p>
        </div>
        <Link href="/admin/livraisons" className="text-sm text-[var(--color-accent)]">
          ← Livraisons
        </Link>
      </div>

      <AdminLivreursTable
        initialLivreurs={livreurs.map((l) => ({
          id: l.id,
          name: l.name,
          phone: l.phone,
          notes: l.notes,
          active: l.active,
          pendingDeliveries: l._count.deliveries,
        }))}
      />
    </div>
  );
}
