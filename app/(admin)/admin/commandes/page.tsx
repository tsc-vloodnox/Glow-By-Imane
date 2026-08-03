import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { ORDER_STATUS_CONFIG, type OrderStatus } from "@/lib/order-status";
import { requireAdmin } from "../actions";
import { BulkDeleteOrders } from "./BulkDeleteOrders";

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
      giftCard: { select: { id: true } },
    },
  });

  const counts = await prisma.order.groupBy({
    by: ["status"],
    _count: true,
  });
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count]));
  const totalCount = counts.reduce((sum, c) => sum + c._count, 0);

  return (
    <div className="space-y-6">
      {/* Header — empile sur très petit écran */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Commandes</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {totalCount} commande{totalCount > 1 ? "s" : ""} au total
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* BulkDeleteOrders reste discret sur mobile — icône seule si tu veux
              aller plus loin, mais en attendant on réduit juste le padding */}
          <BulkDeleteOrders />
          <Link
            href="/admin/commandes/new"
            className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white whitespace-nowrap"
          >
            + Nouvelle
          </Link>
        </div>
      </div>

      {/* Filtres — scroll horizontal, masque la scrollbar visuellement */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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
                  : "border border-[var(--color-border)] bg-white text-[var(--color-muted)] hover:text-[var(--color-accent)]"
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
              .map((i) => `${i.quantity}× ${i.product?.name ?? "Produit supprimé"}`)
              .join(", ");
            const moreItems = order.items.length > 2 ? ` +${order.items.length - 2}` : "";

            return (
              <Link
                key={order.id}
                href={`/admin/commandes/${order.id}`}
                className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3.5 transition-colors hover:border-[var(--color-accent)]"
              >
                {/* Gauche : numéro + client + articles */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="font-medium">#{order.number}</span>
                    {/* Nom tronqué sur mobile, plein sur sm+ */}
                    <span className="max-w-[120px] truncate text-sm text-[var(--color-muted)] sm:max-w-none">
                      {order.name}
                    </span>
                    <span className="hidden text-xs text-[var(--color-muted)] sm:inline">
                      · {order.quartier}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-[var(--color-muted)]">
                    {itemSummary}{moreItems}
                  </p>
                  {/* Quartier visible sur mobile sous le nom, caché sur sm+ */}
                  <p className="mt-0.5 text-xs text-[var(--color-muted)] sm:hidden">
                    {order.quartier}
                  </p>
                </div>

                {/* Droite : total + badges empilés proprement */}
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className="text-sm font-medium tabular-nums">
                    {order.estimatedTotal.toLocaleString("fr-GN")} GNF
                  </span>
                  <div className="flex flex-wrap justify-end gap-1">
                    {order.giftCard && (
                      <span
                        className="rounded-full bg-pink-100 px-2 py-0.5 text-[10px] font-medium text-pink-700 whitespace-nowrap"
                        title="Commande cadeau"
                      >
                        🎁
                      </span>
                    )}
                    {order.delivery && (
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-700 whitespace-nowrap">
                        {order.delivery.status === "LIVREE"
                          ? "Livrée ✓"
                          : order.delivery.scheduledAt
                          ? `Livr. ${new Date(order.delivery.scheduledAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
                          : "Planifiée"}
                      </span>
                    )}
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap ${statusCfg.color}`}>
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