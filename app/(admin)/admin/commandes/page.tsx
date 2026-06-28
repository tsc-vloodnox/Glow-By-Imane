import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { ORDER_STATUS_CONFIG, type OrderStatus } from "@/lib/order-status";
import { requireAdmin } from "../actions";
import { BulkDeleteOrders } from "./BulkDeleteOrders";

// Statuts affichés dans les onglets de filtre (dans l'ordre du workflow)
const FILTER_STATUSES: Array<OrderStatus | "TOUTES"> = [
  "TOUTES",
  "NOUVELLE",
  "DISCUSSION_WHATSAPP",
  "CONFIRMEE",
  "PREPARATION",
  "EN_LIVRAISON",
  "LIVREE",
  "ANNULEE",
];

type Props = {
  searchParams: Promise<{ statut?: string }>;
};

export default async function AdminCommandesPage({ searchParams }: Props) {
  await requireAdmin();

  const { statut } = await searchParams;
  const activeFilter = (statut ?? "TOUTES") as OrderStatus | "TOUTES";

  const orders = await prisma.order.findMany({
    where: activeFilter !== "TOUTES" ? { status: activeFilter } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        include: { product: { select: { name: true } } },
      },
      delivery: { select: { status: true, scheduledAt: true } },
    },
  });

  // Compte par statut pour les badges dans les tabs
  const counts = await prisma.order.groupBy({
    by: ["status"],
    _count: true,
  });
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count]));
  const totalCount = counts.reduce((sum, c) => sum + c._count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Commandes</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {totalCount} commande{totalCount > 1 ? "s" : ""} au total
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BulkDeleteOrders />
          <Link
            href="/admin/commandes/new"
            className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
          >
            + Nouvelle
          </Link>
        </div>
      </div>

      {/* Filtres statut — scroll horizontal sur mobile */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {FILTER_STATUSES.map((s) => {
          const isActive = s === activeFilter;
          const count = s === "TOUTES" ? totalCount : (countMap[s] ?? 0);
          const label = s === "TOUTES" ? "Toutes" : ORDER_STATUS_CONFIG[s].label;

          return (
            <Link
              key={s}
              href={s === "TOUTES" ? "/admin/commandes" : `/admin/commandes?statut=${s}`}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-white border border-[var(--color-border)] text-[var(--color-muted)] hover:text-[var(--color-accent)]"
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`ml-1.5 ${isActive ? "opacity-80" : "opacity-60"}`}>
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Liste */}
      {orders.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 text-sm text-[var(--color-muted)]">
          Aucune commande{activeFilter !== "TOUTES" ? " dans ce statut" : ""}.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {orders.map((order) => {
            const statusCfg = ORDER_STATUS_CONFIG[order.status as OrderStatus];
            const itemSummary = order.items
              .slice(0, 2)
              .map((i) => `${i.quantity}× ${i.product.name}`)
              .join(", ");
            const moreItems = order.items.length > 2 ? ` +${order.items.length - 2}` : "";

            return (
              <Link
                key={order.id}
                href={`/admin/commandes/${order.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 transition-colors hover:border-[var(--color-accent)]"
              >
                {/* Numéro + client */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">#{order.number}</span>
                    <span className="text-sm text-[var(--color-muted)]">{order.name}</span>
                    <span className="hidden text-xs text-[var(--color-muted)] sm:inline">
                      · {order.quartier}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                    {itemSummary}{moreItems}
                  </p>
                </div>

                {/* Droite : total + statuts */}
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-sm font-medium">
                    {order.estimatedTotal.toLocaleString("fr-GN")} GNF
                  </span>
                  <div className="flex items-center gap-1.5">
                    {/* Badge statut livraison si existant */}
                    {order.delivery && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700">
                        {order.delivery.status === "LIVREE"
                          ? "Livrée ✓"
                          : order.delivery.scheduledAt
                          ? `Livr. ${new Date(order.delivery.scheduledAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
                          : "Livraison planifiée"}
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.color}`}>
                      {statusCfg.label}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
