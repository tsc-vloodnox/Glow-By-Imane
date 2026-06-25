import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { withDatabaseFallback } from "@/lib/db";

const statusLabels: Record<string, string> = {
  NOUVELLE: "Nouvelle",
  DISCUSSION_WHATSAPP: "Discussion WhatsApp",
  CONFIRMEE: "Confirmée",
  PREPARATION: "Préparation",
  EN_LIVRAISON: "En livraison",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

type RecentOrder = Awaited<ReturnType<typeof prisma.order.findMany>>[number];

export default async function AdminDashboardPage() {
  const [orderCount, productCount, recentOrders] = await withDatabaseFallback(
    async () => {
      const [countOrders, countProducts, recent] = await Promise.all([
        prisma.order.count(),
        prisma.product.count(),
        prisma.order.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          include: { items: true },
        }),
      ]);

      return [countOrders, countProducts, recent] as const;
    },
    [0, 0, [] as RecentOrder[]],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-[var(--color-muted)]">Glow by Imane — Admin</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6">
          <p className="text-sm text-[var(--color-muted)]">Commandes</p>
          <p className="mt-2 text-3xl font-semibold">{orderCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6">
          <p className="text-sm text-[var(--color-muted)]">Produits</p>
          <p className="mt-2 text-3xl font-semibold">{productCount}</p>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-sand)] p-4 text-sm text-[var(--color-muted)]">
        La base de données est actuellement indisponible. Les données affichées ci-dessous sont temporaires jusqu’à la reconnexion.
      </div>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium">Dernières commandes</h2>
          <Link href="/admin/commandes" className="text-sm text-[var(--color-accent)]">
            Voir tout
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
          {recentOrders.length === 0 ? (
            <p className="p-6 text-sm text-[var(--color-muted)]">Aucune commande.</p>
          ) : (
            <ul className="divide-y divide-[var(--color-border)]">
              {recentOrders.map((order) => (
                <li key={order.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="font-medium">#{order.number} — {order.name}</p>
                    <p className="text-sm text-[var(--color-muted)]">{order.phone}</p>
                  </div>
                  <span className="rounded-full bg-[var(--color-blush)] px-3 py-1 text-xs">
                    {statusLabels[order.status]}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
