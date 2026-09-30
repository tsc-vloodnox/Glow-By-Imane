"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { DELIVERY_STATUS_CONFIG, type DeliveryStatus } from "@/lib/order-status";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import {
  createDelivery as createDeliveryAction,
  updateDelivery as updateDeliveryAction,
  updateDeliveryStatus as updateDeliveryStatusAction,
} from "../../actions";
import { unwrapAction } from "@/lib/action-result";

// Actions serveur : lèvent une Error au message lisible en cas d'échec (cf. lib/action-result.ts)
const createDelivery = unwrapAction(createDeliveryAction);
const updateDelivery = unwrapAction(updateDeliveryAction);
const updateDeliveryStatus = unwrapAction(updateDeliveryStatusAction);

type DeliveryData = {
  id: string;
  status: string;
  scheduledAt: Date;
  deliveredAt: Date | null;
  livreurId: string | null;
  livreur: string | null;
  deliveryFee: number;
  notes: string | null;
  run: { id: string; settled: boolean } | null;
} | null;

type GiftDelivery = { recipientName: string; recipientAddress: string } | null;

type Props = {
  orderId: string;
  orderNumber: number;
  orderName: string;
  orderPhone: string;
  orderQuartier: string;
  orderFinalTotal: number;
  /** Frais proposés par défaut à la planification (bas de la fourchette annoncée) */
  suggestedFee?: number | null;
  /** Commande à retirer en boutique : la planification reste possible si la cliente change d'avis */
  isPickup?: boolean;
  livreurs: { id: string; name: string }[];
  delivery: DeliveryData;
  giftDelivery?: GiftDelivery;
};

/** Valeur pour <input type="datetime-local"> (heure locale du navigateur) */
function toLocalInput(date: Date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function defaultSchedule() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return toLocalInput(d);
}

export function DeliveryPanel({
  orderId,
  orderNumber,
  orderName,
  orderPhone,
  orderQuartier,
  orderFinalTotal,
  suggestedFee,
  isPickup,
  livreurs,
  delivery,
  giftDelivery,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const localDelivery = delivery;
  const locked = delivery?.run?.settled ?? false;

  function buildWhatsAppMessage(scheduledDate: string) {
    const date = new Date(scheduledDate);
    const formatted = date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const fee = localDelivery?.deliveryFee ?? 0;
    const total = orderFinalTotal + fee;
    return (
      `Bonjour ${orderName} 👋\n\nVotre commande Glow by Imane #${orderNumber} sera livrée le *${formatted}* à ${orderQuartier}.\n\n` +
      `Total commande : ${orderFinalTotal.toLocaleString("fr-GN")} GNF\n` +
      (fee > 0 ? `Frais de livraison : ${fee.toLocaleString("fr-GN")} GNF\n` : "") +
      `*Total à payer : ${total.toLocaleString("fr-GN")} GNF*\n\n` +
      `Nous vous contacterons à votre arrivée. Merci de votre confiance ! 🌸`
    );
  }

  function act(action: () => Promise<unknown>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        after?.();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("orderId", orderId);
    act(() => createDelivery(formData), () => setShowForm(false));
  }

  function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    act(() => updateDelivery(localDelivery!.id, formData), () => setEditing(false));
  }

  function handleStatusChange(deliveryId: string, status: DeliveryStatus) {
    act(() => updateDeliveryStatus(deliveryId, status));
  }

  /** Champs communs création / modification */
  function fields(initial: { scheduledAt: string; livreurId: string; deliveryFee: number; notes: string }) {
    return (
      <>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Date et heure</span>
          <input
            type="datetime-local"
            name="scheduledAt"
            required
            defaultValue={initial.scheduledAt}
            className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Livreur</span>
          <select
            name="livreurId"
            defaultValue={initial.livreurId}
            className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm"
          >
            <option value="">Non attribué</option>
            {livreurs.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          {livreurs.length === 0 && (
            <span className="block text-xs text-[var(--color-muted)]">
              Aucun livreur actif.{" "}
              <Link href="/admin/livreurs" className="text-[var(--color-accent)] underline">Ajouter un livreur</Link>
            </span>
          )}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Frais de livraison payés par la cliente (GNF)</span>
          <input
            type="number"
            name="deliveryFee"
            min="0"
            step="500"
            defaultValue={initial.deliveryFee}
            className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm"
            placeholder="0"
          />
          <span className="block text-xs text-[var(--color-muted)]">0 = livraison offerte / exemptée.</span>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Notes (optionnel)</span>
          <textarea
            name="notes"
            rows={2}
            maxLength={500}
            defaultValue={initial.notes}
            placeholder="Point de repère, instructions spéciales…"
            className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm"
          />
        </label>
      </>
    );
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

      {giftDelivery && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          🎁 Commande cadeau — livrer à <strong>{giftDelivery.recipientName}</strong> :{" "}
          {giftDelivery.recipientAddress} (et non à l&apos;adresse de la cliente ci-dessous).
        </p>
      )}

      {/* Pas encore de livraison */}
      {!localDelivery && !showForm && (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-[var(--color-muted)]">
            {isPickup ? "Retrait en boutique : rien à planifier, sauf si la cliente demande finalement une livraison." : "Aucune livraison planifiée."}
          </p>
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
          {fields({ scheduledAt: defaultSchedule(), livreurId: "", deliveryFee: suggestedFee ?? 0, notes: "" })}

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
      {localDelivery && editing && (
        <form onSubmit={handleUpdate} className="space-y-3">
          {fields({
            scheduledAt: toLocalInput(localDelivery.scheduledAt),
            livreurId: localDelivery.livreurId ?? "",
            deliveryFee: localDelivery.deliveryFee,
            notes: localDelivery.notes ?? "",
          })}
          {localDelivery.run && (
            <p className="text-xs text-[var(--color-muted)]">Changer de livreur retire la livraison de sa tournée actuelle.</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {isPending ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-sm text-[var(--color-muted)]">
              Annuler
            </button>
          </div>
        </form>
      )}

      {localDelivery && !editing && (
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
            <div>
              <dt className="text-[var(--color-muted)]">Livreur</dt>
              <dd className={`font-medium ${localDelivery.livreur ? "" : "text-amber-600"}`}>
                {localDelivery.livreur ?? "Non attribué"}
              </dd>
            </div>
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

          {(localDelivery.run || !locked) && (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              {!locked && (
                <button type="button" onClick={() => setEditing(true)} className="text-[var(--color-accent)] underline">
                  Modifier (date, livreur, frais)
                </button>
              )}
              {localDelivery.run && (
                <Link href={`/admin/livraisons/tournees/${localDelivery.run.id}`} className="text-indigo-600 hover:underline">
                  🗺 Voir la tournée{locked ? " (réglée)" : ""}
                </Link>
              )}
            </div>
          )}

          {localDelivery.status !== "LIVREE" && (
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
            href={buildWhatsAppUrl(orderPhone, buildWhatsAppMessage(localDelivery.scheduledAt.toString()))}
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
