import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { ORDER_STATUS_CONFIG, type OrderStatus } from "@/lib/order-status";
import { requireAdmin } from "../../actions";
import { OrderStatusChanger } from "./OrderStatusChanger";
import { DeliveryPanel } from "./DeliveryPanel";
import { OrderDiscountEditor } from "./OrderDiscountEditor";

type Props = { params: Promise<{ id: string }> };

const SOURCE_LABEL: Record<string, string> = {
  app: "Application",
  whatsapp: "WhatsApp",
  admin: "Saisie admin",
};

export default async function OrderDetailPage({ params }: Props) {
  await requireAdmin();
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: { select: { id: true, name: true, images: true } } } },
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
          <Link href="/admin/commandes" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]">
            ← Commandes
          </Link>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Commande #{order.number}</h1>
            {order.source !== "app" && (
              <span className="rounded-full border border-[var(--color-border)] px-2.5 py-0.5 text-xs text-[var(--color-muted)]">
                {SOURCE_LABEL[order.source] ?? order.source}
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--color-muted)]">
            {new Date(order.createdAt).toLocaleDateString("fr-FR", {
              day: "numeric", month: "long", year: "numeric",
              hour: "2-digit", minute: "2-digit",
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
          {/* Articles + totaux */}
          <section className="rounded-xl border border-[var(--color-border)] bg-white p-4">
            <h2 className="mb-3 font-medium">Articles & total</h2>
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

            {/* Remise */}
            <div className="mt-4 border-t border-[var(--color-border)] pt-4">
              <OrderDiscountEditor
                orderId={order.id}
                estimatedTotal={order.estimatedTotal}
                discountAmount={order.discountAmount}
                discountReason={order.discountReason}
                finalTotal={order.finalTotal}
              />
            </div>
          </section>

          {/* Statut */}
          <section className="rounded-xl border border-[var(--color-border)] bg-white p-4">
            <h2 className="mb-3 font-medium">Changer le statut</h2>
            <OrderStatusChanger orderId={order.id} currentStatus={order.status as OrderStatus} />
          </section>

          {/* Livraison */}
          <DeliveryPanel
            orderId={order.id}
            orderNumber={order.number}
            orderName={order.name}
            orderPhone={order.phone}
            orderQuartier={order.quartier}
            orderFinalTotal={order.finalTotal}
            delivery={order.delivery ? {
              ...order.delivery,
              deliveryFee: order.delivery.deliveryFee ?? 0,
            } : null}
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
                  <dd className="font-semibold text-[var(--color-accent)]">{order.customer.loyaltyPts} pts</dd>
                </div>
                {order.customer.vip && (
                  <dd className="rounded-full bg-[var(--color-blush)] px-3 py-1 text-center text-xs font-medium text-[var(--color-accent)]">
                    ⭐ Cliente VIP
                  </dd>
                )}
              </dl>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
