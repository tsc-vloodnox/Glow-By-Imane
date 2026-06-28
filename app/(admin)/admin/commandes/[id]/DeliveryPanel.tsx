"use client";

import { useState, useTransition } from "react";

import { DELIVERY_STATUS_CONFIG, type DeliveryStatus } from "@/lib/order-status";
import { createDelivery, updateDeliveryStatus } from "../../actions";

type DeliveryData = {
  id: string;
  status: string;
  scheduledAt: Date;
  deliveredAt: Date | null;
  livreur: string | null;
  deliveryFee: number;
  notes: string | null;
} | null;

type Props = {
  orderId: string;
  orderNumber: number;
  orderName: string;
  orderPhone: string;
  orderQuartier: string;
  orderFinalTotal: number;
  delivery: DeliveryData;
};

export function DeliveryPanel({
  orderId,
  orderNumber,
  orderName,
  orderPhone,
  orderQuartier,
  orderFinalTotal,
  delivery,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localDelivery, setLocalDelivery] = useState(delivery);

  function buildWhatsAppMessage(scheduledDate: string) {
    const date = new Date(scheduledDate);
    const formatted = date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const fee = localDelivery?.deliveryFee ?? 0;
    const total = orderFinalTotal + fee;
    return encodeURIComponent(
      `Bonjour ${orderName} 👋\n\nVotre commande Glow by Imane #${orderNumber} sera livrée le *${formatted}* à ${orderQuartier}.\n\n` +
      `Total commande : ${orderFinalTotal.toLocaleString("fr-GN")} GNF\n` +
      (fee > 0 ? `Frais de livraison : ${fee.toLocaleString("fr-GN")} GNF\n` : "") +
      `*Total à payer : ${total.toLocaleString("fr-GN")} GNF*\n\n` +
      `Nous vous contacterons à votre arrivée. Merci de votre confiance ! 🌸`,
    );
  }

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    formData.set("orderId", orderId);

    startTransition(async () => {
      try {
        await createDelivery(formData);
        const scheduledAt = new Date(String(formData.get("scheduledAt")));
        setLocalDelivery({
          id: "pending",
          status: "PLANIFIEE",
          scheduledAt,
          deliveredAt: null,
          livreur: String(formData.get("livreur") ?? "") || null,
          deliveryFee: Math.max(0, Number(formData.get("deliveryFee") ?? 0)),
          notes: String(formData.get("notes") ?? "") || null,
        });
        setShowForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de la planification.");
      }
    });
  }

  async function handleStatusChange(deliveryId: string, status: DeliveryStatus) {
    startTransition(async () => {
      await updateDeliveryStatus(deliveryId, status);
      setLocalDelivery((prev) =>
        prev ? { ...prev, status, deliveredAt: status === "LIVREE" ? new Date() : prev.deliveredAt } : prev,
      );
    });
  }

  const deliveryCfg = localDelivery
    ? DELIVERY_STATUS_CONFIG[localDelivery.status as DeliveryStatus]
    : null;

  const totalWithDelivery = orderFinalTotal + (localDelivery?.deliveryFee ?? 0);

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">Livraison</h2>
        {localDelivery && deliveryCfg && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${deliveryCfg.color}`}>
            {deliveryCfg.label}
          </span>
        )}
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Pas encore de livraison */}
      {!localDelivery && !showForm && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-[var(--color-muted)]">Aucune livraison planifiée.</p>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white"
          >
            Planifier une livraison
          </button>
        </div>
      )}

      {/* Formulaire */}
      {!localDelivery && showForm && (
        <form onSubmit={handleCreate} className="space-y-3">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Date et heure</span>
            <input
              type="datetime-local"
              name="scheduledAt"
              required
              className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Livreur (optionnel)</span>
            <input
              type="text"
              name="livreur"
              placeholder="Prénom du livreur"
              className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Frais de livraison (GNF)</span>
            <input
              type="number"
              name="deliveryFee"
              min="0"
              defaultValue={0}
              className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm"
              placeholder="0"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Notes (optionnel)</span>
            <textarea
              name="notes"
              rows={2}
              placeholder="Point de repère, instructions spéciales…"
              className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {isPending ? "Planification…" : "Confirmer"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-[var(--color-muted)]">
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Livraison existante */}
      {localDelivery && (
        <div className="space-y-3">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div>
              <dt className="text-[var(--color-muted)]">Date prévue</dt>
              <dd className="font-medium">
                {new Date(localDelivery.scheduledAt).toLocaleDateString("fr-FR", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </dd>
            </div>
            {localDelivery.livreur && (
              <div>
                <dt className="text-[var(--color-muted)]">Livreur</dt>
                <dd className="font-medium">{localDelivery.livreur}</dd>
              </div>
            )}
            <div>
              <dt className="text-[var(--color-muted)]">Frais livraison</dt>
              <dd className="font-medium">
                {localDelivery.deliveryFee > 0
                  ? `${localDelivery.deliveryFee.toLocaleString("fr-GN")} GNF`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-muted)]">Total à encaisser</dt>
              <dd className="font-semibold text-[var(--color-accent)]">
                {totalWithDelivery.toLocaleString("fr-GN")} GNF
              </dd>
            </div>
            {localDelivery.deliveredAt && (
              <div className="col-span-2">
                <dt className="text-[var(--color-muted)]">Livré le</dt>
                <dd className="font-medium text-green-700">
                  {new Date(localDelivery.deliveredAt).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </dd>
              </div>
            )}
            {localDelivery.notes && (
              <div className="col-span-2">
                <dt className="text-[var(--color-muted)]">Notes</dt>
                <dd className="rounded-lg bg-[var(--color-sand)] p-2">{localDelivery.notes}</dd>
              </div>
            )}
          </dl>

          {localDelivery.status !== "LIVREE" && localDelivery.id !== "pending" && (
            <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-3">
              {localDelivery.status === "PLANIFIEE" && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleStatusChange(localDelivery.id, "EN_COURS")}
                  className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 disabled:opacity-50"
                >
                  → En cours
                </button>
              )}
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleStatusChange(localDelivery.id, "LIVREE")}
                className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                ✓ Marquer livrée
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleStatusChange(localDelivery.id, "REPORTEE")}
                className="rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs font-medium text-yellow-700 disabled:opacity-50"
              >
                Reporter
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleStatusChange(localDelivery.id, "ECHOUEE")}
                className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 disabled:opacity-50"
              >
                Échec
              </button>
            </div>
          )}

          <a
            href={`https://wa.me/224${orderPhone.replace(/^0/, "")}?text=${buildWhatsAppMessage(localDelivery.scheduledAt.toString())}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700 hover:bg-green-100"
          >
            <span>💬</span>
            Notifier le client sur WhatsApp
          </a>
        </div>
      )}
    </section>
  );
}
