import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../actions";
import { DELIVERY_STATUS_CONFIG, type DeliveryStatus } from "@/lib/order-status";
import { LivraisonStatusButton } from "./LivraisonStatusButton";
import { QuartierCopyButton } from "./QuartierCopyButton";
import Link from "next/link";

// Retourne les 7 prochains jours avec livraisons (+ aujourd'hui)
function groupByDay(deliveries: Array<{
  id: string;
  scheduledAt: Date;
  status: string;
  livreur: string | null;
  notes: string | null;
  order: {
    id: string;
    number: number;
    name: string;
    phone: string;
    quartier: string;
    estimatedTotal: number;
  };
}>) {
  const map = new Map<string, typeof deliveries>();

  for (const d of deliveries) {
    const key = d.scheduledAt.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(d);
  }

  return map;
}

export default async function AdminLivraisonsPage() {
  await requireAdmin();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Livraisons non livrées + celles livrées aujourd'hui
  const deliveries = await prisma.delivery.findMany({
    where: {
      OR: [
        { status: { not: "LIVREE" } },
        {
          status: "LIVREE",
          deliveredAt: { gte: today },
        },
      ],
    },
    orderBy: { scheduledAt: "asc" },
    include: {
      order: {
        select: {
          id: true,
          number: true,
          name: true,
          phone: true,
          quartier: true,
          estimatedTotal: true,
        },
      },
    },
  });

  const grouped = groupByDay(deliveries);
  const todayKey = today.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const pendingCount = deliveries.filter(
    (d) => d.status === "PLANIFIEE" || d.status === "EN_COURS",
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Livraisons</h1>
        <p className="text-sm text-[var(--color-muted)]">
          {pendingCount} en attente · vue des 7 prochains jours
        </p>
      </div>

      {grouped.size === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 text-sm text-[var(--color-muted)]">
          Aucune livraison à venir.{" "}
          <Link href="/admin/commandes" className="text-[var(--color-accent)] hover:underline">
            Planifier depuis une commande →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([dayLabel, dayDeliveries]) => {
            const isToday = dayLabel === todayKey;

            // Groupe par quartier dans la journée
            const byQuartier = new Map<string, typeof dayDeliveries>();
            for (const d of dayDeliveries) {
              const q = d.order.quartier;
              if (!byQuartier.has(q)) byQuartier.set(q, []);
              byQuartier.get(q)!.push(d);
            }

            return (
              <div key={dayLabel}>
                {/* En-tête du jour */}
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="font-semibold capitalize">
                    {isToday ? "Aujourd'hui" : dayLabel}
                    {isToday && (
                      <span className="ml-2 rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[10px] font-medium text-white">
                        Aujourd&apos;hui
                      </span>
                    )}
                  </h2>
                  <span className="text-sm text-[var(--color-muted)]">
                    {dayDeliveries.length} livraison{dayDeliveries.length > 1 ? "s" : ""}
                  </span>
                </div>

                {/* Groupes par quartier */}
                <div className="space-y-3">
                  {[...byQuartier.entries()].map(([quartier, items]) => (
                    <div
                      key={quartier}
                      className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white"
                    >
                      {/* Header quartier */}
                      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-sand)] px-4 py-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                          📍 {quartier}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-[var(--color-muted)]">
                            {items.length} arrêt{items.length > 1 ? "s" : ""}
                          </span>
                          <QuartierCopyButton
                            quartier={quartier}
                            date={dayLabel}
                            deliveries={items.map((d) => ({
                              orderNumber: d.order.number,
                              orderName: d.order.name,
                              orderPhone: d.order.phone,
                              scheduledAt: d.scheduledAt,
                              finalTotal: d.order.estimatedTotal,
                              deliveryFee: 0,
                              notes: d.notes,
                            }))}
                          />
                        </div>
                      </div>

                      {/* Livraisons du quartier */}
                      <ul className="divide-y divide-[var(--color-border)]">
                        {items.map((delivery) => {
                          const cfg = DELIVERY_STATUS_CONFIG[delivery.status as DeliveryStatus];
                          const time = delivery.scheduledAt.toLocaleTimeString("fr-FR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          });

                          return (
                            <li key={delivery.id} className="flex items-center gap-3 px-4 py-3">
                              {/* Heure */}
                              <span className="w-12 shrink-0 text-center text-xs font-medium text-[var(--color-muted)]">
                                {time}
                              </span>

                              {/* Info commande */}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <Link
                                    href={`/admin/commandes/${delivery.order.id}`}
                                    className="text-sm font-medium hover:text-[var(--color-accent)]"
                                  >
                                    #{delivery.order.number} — {delivery.order.name}
                                  </Link>
                                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.color}`}>
                                    {cfg.label}
                                  </span>
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted)]">
                                  <span>{delivery.order.estimatedTotal.toLocaleString("fr-GN")} GNF</span>
                                  {delivery.livreur && <span>· {delivery.livreur}</span>}
                                  {delivery.notes && <span>· {delivery.notes}</span>}
                                </div>
                              </div>

                              {/* Actions rapides */}
                              <div className="flex shrink-0 items-center gap-2">
                                {/* WhatsApp */}
                                <a
                                  href={`https://wa.me/224${delivery.order.phone.replace(/^0/, "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100"
                                  title="Contacter sur WhatsApp"
                                >
                                  💬
                                </a>

                                {/* Bouton statut */}
                                {delivery.status !== "LIVREE" && (
                                  <LivraisonStatusButton
                                    deliveryId={delivery.id}
                                    currentStatus={delivery.status as DeliveryStatus}
                                  />
                                )}

                                {delivery.status === "LIVREE" && (
                                  <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                                    ✓ Livrée
                                  </span>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
