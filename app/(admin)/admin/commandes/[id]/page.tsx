import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { ORDER_STATUS_CONFIG, type OrderStatus } from "@/lib/order-status";
import { requireAdmin } from "../../actions";
import { OrderStatusChanger } from "./OrderStatusChanger";
import { DeliveryPanel } from "./DeliveryPanel";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function OrderDetailPage({ params }: Props) {
  await requireAdmin();

  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, images: true } },
        },
      },
      customer: true,
      delivery: true,
    },
  });

  if (!order) notFound();

  const statusCfg = ORDER_STATUS_CONFIG[order.status as OrderStatus];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Link
              href="/admin/commandes"
              className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]"
            >
              ← Commandes
            </Link>
          </div>
          <h1 className="mt-1 text-2xl font-semibold">Commande #{order.number}</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {new Date(order.createdAt).toLocaleDateString("fr-FR", {
              day: "numeric",
              month: "long",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-medium ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="space-y-4 lg:col-span-2">
          {/* Articles */}
          <section className="rounded-xl border border-[var(--color-border)] bg-white p-4">
            <h2 className="mb-3 font-medium">Articles</h2>
            <ul className="divide-y divide-[var(--color-border)]">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-sand)] text-xs font-semibold text-[var(--color-accent)]">
                      {item.quantity}
                    </span>
                    <span className="text-sm">{item.product.name}</span>
                  </div>
                  <span className="shrink-0 text-sm font-medium">
                    {(item.unitPrice * item.quantity).toLocaleString("fr-GN")} GNF
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-[var(--color-border)] pt-3">
              <span className="text-sm font-medium">Total estimé</span>
              <span className="font-semibold">
                {order.estimatedTotal.toLocaleString("fr-GN")} GNF
              </span>
            </div>
          </section>

          {/* Statut */}
          <section className="rounded-xl border border-[var(--color-border)] bg-white p-4">
            <h2 className="mb-3 font-medium">Changer le statut</h2>
            <OrderStatusChanger
              orderId={order.id}
              currentStatus={order.status as OrderStatus}
            />
          </section>

          {/* Livraison */}
          <DeliveryPanel
            orderId={order.id}
            orderNumber={order.number}
            orderName={order.name}
            orderPhone={order.phone}
            orderQuartier={order.quartier}
            orderTotal={order.estimatedTotal}
            delivery={order.delivery}
          />
        </div>

        {/* Colonne client */}
        <div className="space-y-4">
          <section className="rounded-xl border border-[var(--color-border)] bg-white p-4">
            <h2 className="mb-3 font-medium">Client</h2>
            <dl className="space-y-2 text-sm">
              <div>
                <dt className="text-[var(--color-muted)]">Nom</dt>
                <dd className="font-medium">{order.name}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted)]">Téléphone</dt>
                <dd>
                  <a
                    href={`https://wa.me/224${order.phone.replace(/^0/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-accent)] hover:underline"
                  >
                    {order.phone}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-muted)]">Quartier</dt>
                <dd>{order.quartier}</dd>
              </div>
              {order.comment && (
                <div>
                  <dt className="text-[var(--color-muted)]">Commentaire</dt>
                  <dd className="rounded-lg bg-[var(--color-sand)] p-2">{order.comment}</dd>
                </div>
              )}
            </dl>
          </section>

          {order.customer && (
            <section className="rounded-xl border border-[var(--color-border)] bg-white p-4">
              <h2 className="mb-3 font-medium">Profil client</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-[var(--color-muted)]">Points fidélité</dt>
                  <dd className="font-semibold text-[var(--color-accent)]">
                    {order.customer.loyaltyPts} pts
                  </dd>
                </div>
                {order.customer.vip && (
                  <div>
                    <dd className="rounded-full bg-[var(--color-blush)] px-3 py-1 text-center text-xs font-medium text-[var(--color-accent)]">
                      ⭐ Cliente VIP
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
