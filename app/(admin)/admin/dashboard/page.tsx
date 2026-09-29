import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { withDatabaseFallback } from "@/lib/db";
import { getRestockNeeds } from "@/lib/restock";
import { requireAdmin } from "../actions";

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
type LowStockProduct = { id: string; name: string; stock: number };

export default async function AdminDashboardPage() {
  // Lit le cookie de session → page rendue à chaque visite (sinon Next la pré-générait
  // au build et les statistiques restaient figées)
  await requireAdmin();

  const restockNeeds = await withDatabaseFallback(getRestockNeeds, []);

  const [
    orderCount,
    productCount,
    kitCount,
    pendingDeliveryCount,
    unassignedDeliveryCount,
    lowStockProducts,
    recentOrders,
  ] = await withDatabaseFallback(
    async () => {
      const [
        countOrders,
        countProducts,
        countKits,
        countPendingDeliveries,
        countUnassignedDeliveries,
        lowStock,
        recent,
      ] = await Promise.all([
        prisma.order.count(),
        prisma.product.count({ where: { archived: false } }),
        prisma.kit.count({ where: { archived: false } }),
        prisma.delivery.count({ where: { status: { in: ["PLANIFIEE", "EN_COURS"] } } }),
        prisma.delivery.count({
          where: { status: { in: ["PLANIFIEE", "EN_COURS"] }, livreurId: null },
        }),
        prisma.product.findMany({
          // Stock négatif exclu : affiché dans « À réapprovisionner »
          where: { archived: false, stock: { gte: 0, lte: 3 } },
          orderBy: { stock: "asc" },
          take: 5,
          select: { id: true, name: true, stock: true },
        }),
        prisma.order.findMany({
          take: 5,
          orderBy: { createdAt: "desc" },
          include: { items: true },
        }),
      ]);

      return [
        countOrders,
        countProducts,
        countKits,
        countPendingDeliveries,
        countUnassignedDeliveries,
        lowStock,
        recent,
      ] as const;
    },
    [0, 0, 0, 0, 0, [] as LowStockProduct[], [] as RecentOrder[]],
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-[var(--color-muted)]">Glow by Imane — Admin</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6">
          <p className="text-sm text-[var(--color-muted)]">Commandes</p>
          <p className="mt-2 text-3xl font-semibold">{orderCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6">
          <p className="text-sm text-[var(--color-muted)]">Produits actifs</p>
          <p className="mt-2 text-3xl font-semibold">{productCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6">
          <p className="text-sm text-[var(--color-muted)]">Kits actifs</p>
          <p className="mt-2 text-3xl font-semibold">{kitCount}</p>
        </div>
        <Link
          href="/admin/livraisons"
          className="rounded-xl border border-[var(--color-border)] bg-white p-6 transition-colors hover:border-[var(--color-accent)]"
        >
          <p className="text-sm text-[var(--color-muted)]">Livraisons en attente</p>
          <p className="mt-2 text-3xl font-semibold">{pendingDeliveryCount}</p>
        </Link>
        <Link
          href="/admin/livraisons"
          className={`rounded-xl border p-6 transition-colors ${
            unassignedDeliveryCount > 0
              ? "border-amber-200 bg-amber-50 hover:border-amber-300"
              : "border-[var(--color-border)] bg-white hover:border-[var(--color-accent)]"
          }`}
        >
          <p className={`text-sm ${unassignedDeliveryCount > 0 ? "text-amber-700" : "text-[var(--color-muted)]"}`}>
            Non attribuées
          </p>
          <p className={`mt-2 text-3xl font-semibold ${unassignedDeliveryCount > 0 ? "text-amber-700" : ""}`}>
            {unassignedDeliveryCount}
          </p>
        </Link>
      </div>

      {restockNeeds.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium">À réapprovisionner</h2>
            <Link href="/admin/commandes?type=gros" className="text-sm text-[var(--color-accent)]">
              Commandes en gros
            </Link>
          </div>
          <p className="mb-2 text-sm text-[var(--color-muted)]">
            Quantités promises à des revendeurs au-delà du stock disponible.
          </p>
          <div className="overflow-hidden rounded-xl border border-indigo-200 bg-indigo-50">
            <ul className="divide-y divide-indigo-200">
              {restockNeeds.map((need) => (
                <li key={need.key} className="flex items-center justify-between px-4 py-3">
                  <Link href={`/admin/produits/${need.productId}/edit`} className="text-sm font-medium hover:underline">
                    {need.label}
                  </Link>
                  <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700">
                    {need.missing} à commander
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {lowStockProducts.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium">Stock bas</h2>
            <Link href="/admin/produits" className="text-sm text-[var(--color-accent)]">
              Voir tous les produits
            </Link>
          </div>
          <div className="overflow-hidden rounded-xl border border-amber-200 bg-amber-50">
            <ul className="divide-y divide-amber-200">
              {lowStockProducts.map((product) => (
                <li key={product.id} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm font-medium">{product.name}</span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                    {product.stock < 0
                      ? `${-product.stock} à réapprovisionner`
                      : product.stock === 0
                        ? "Rupture"
                        : `${product.stock} en stock`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

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
