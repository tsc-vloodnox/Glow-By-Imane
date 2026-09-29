import Link from "next/link";
import { notFound } from "next/navigation";

import { getCustomerStats } from "@/lib/customer-stats";
import { ORDER_STATUS_CONFIG, type OrderStatus } from "@/lib/order-status";
import { orderItemLabel } from "@/lib/order-items";
import { prisma } from "@/lib/prisma";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { requireAdmin } from "../../actions";
import { CustomerEditor } from "./CustomerEditor";

type Props = { params: Promise<{ id: string }> };

export default async function AdminClientePage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            include: {
              product: { select: { name: true } },
              productSize: { select: { label: true } },
              kit: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!customer) notFound();

  const stats = (await getCustomerStats([customer.id])).get(customer.id);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/clientes" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]">
          ← Clientes
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">{customer.name}</h1>
          {customer.isReseller && (
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-700">Revendeur</span>
          )}
        </div>
        <p className="text-sm text-[var(--color-muted)]">
          {customer.businessName ? `${customer.businessName} · ` : ""}
          {customer.quartier} ·{" "}
          <a href={buildWhatsAppUrl(customer.phone)} target="_blank" rel="noopener noreferrer"
            className="text-[var(--color-accent)] hover:underline">
            +{customer.phone}
          </a>
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Commandes", value: String(stats?.orderCount ?? 0) },
          { label: "Total dépensé", value: `${(stats?.totalSpent ?? 0).toLocaleString("fr-GN")} GNF` },
          {
            label: "Dernière commande",
            value: stats?.lastOrderAt ? stats.lastOrderAt.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—",
          },
        ].map((tile) => (
          <div key={tile.label} className="rounded-xl border border-[var(--color-border)] bg-white p-4">
            <p className="text-xs text-[var(--color-muted)]">{tile.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{tile.value}</p>
          </div>
        ))}
      </div>
      <p className="-mt-3 text-xs text-[var(--color-muted)]">Hors commandes annulées.</p>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-2 lg:col-span-2">
          <h2 className="font-medium">Historique des commandes</h2>
          {customer.orders.length === 0 ? (
            <p className="rounded-xl border border-[var(--color-border)] bg-white p-4 text-sm text-[var(--color-muted)]">
              Aucune commande.
            </p>
          ) : (
            customer.orders.map((order) => {
              const statusCfg = ORDER_STATUS_CONFIG[order.status as OrderStatus];
              return (
                <Link key={order.id} href={`/admin/commandes/${order.id}`}
                  className="flex items-start justify-between gap-3 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3 hover:border-[var(--color-accent)]">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      #{order.number}{" "}
                      <span className="font-normal text-[var(--color-muted)]">
                        · {order.createdAt.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </p>
                    <p className="truncate text-xs text-[var(--color-muted)]">
                      {order.items.map((item) => `${item.quantity}× ${orderItemLabel(item)}`).join(", ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className="text-sm font-medium tabular-nums">{order.finalTotal.toLocaleString("fr-GN")} GNF</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusCfg.color}`}>{statusCfg.label}</span>
                  </div>
                </Link>
              );
            })
          )}
        </section>

        <section className="h-fit rounded-xl border border-[var(--color-border)] bg-white p-4">
          <h2 className="mb-3 font-medium">Fiche</h2>
          <CustomerEditor
            customer={{
              id: customer.id,
              name: customer.name,
              businessName: customer.businessName,
              isReseller: customer.isReseller,
              notes: customer.notes,
            }}
          />
        </section>
      </div>
    </div>
  );
}
