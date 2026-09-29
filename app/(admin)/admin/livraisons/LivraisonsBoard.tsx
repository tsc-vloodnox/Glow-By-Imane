"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { unwrapAction } from "@/lib/action-result";
import { formatFeeRange } from "@/lib/delivery";
import { DELIVERY_STATUS_CONFIG, ORDER_STATUS_CONFIG, type DeliveryStatus, type OrderStatus } from "@/lib/order-status";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import {
  assignLivreur as assignLivreurAction,
  createLivreur as createLivreurAction,
  planDeliveries as planDeliveriesAction,
  updateDeliveryFee as updateDeliveryFeeAction,
} from "../actions";
import { LivraisonStatusButton } from "./LivraisonStatusButton";
import { QuartierCopyButton } from "./QuartierCopyButton";
import { createRun as createRunAction } from "./tournees/actions";

// Actions serveur : lèvent une Error au message lisible en cas d'échec (cf. lib/action-result.ts)
const assignLivreur = unwrapAction(assignLivreurAction);
const createLivreur = unwrapAction(createLivreurAction);
const planDeliveries = unwrapAction(planDeliveriesAction);
const updateDeliveryFee = unwrapAction(updateDeliveryFeeAction);
const createRun = unwrapAction(createRunAction);

type DeliveryRow = {
  id: string;
  scheduledAt: Date;
  status: string;
  notes: string | null;
  deliveryFee: number;
  livreurId: string | null;
  livreur: { id: string; name: string } | null;
  runId: string | null;
  runSettled: boolean;
  order: {
    id: string;
    number: number;
    name: string;
    phone: string;
    /** Adresse complète saisie (quartier + précisions) */
    address: string;
    /** Quartier de référence, pour regrouper les arrêts voisins */
    zone: string;
    finalTotal: number;
    depositAmount: number;
  };
};

type OrderToPlan = {
  id: string;
  number: number;
  name: string;
  status: string;
  address: string;
  zone: string;
  feeMin: number | null;
  feeMax: number | null;
};

type LivreurOption = { id: string; name: string };

type Props = {
  deliveries: DeliveryRow[];
  livreurs: LivreurOption[];
  toPlan: OrderToPlan[];
};

const dayLabel = (date: Date) => date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const gnf = (value: number) => `${value.toLocaleString("fr-GN")} GNF`;
/** Reste à encaisser à la livraison : total − acompte + frais */
const toCollect = (d: DeliveryRow) => Math.max(d.order.finalTotal - d.order.depositAmount, 0) + d.deliveryFee;

function groupBy<T>(items: T[], key: (item: T) => string) {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(item);
  }
  return map;
}

/** Demain 10 h, au format <input type="datetime-local"> */
function tomorrowMorning() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

const selectClass = "rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm";

export function LivraisonsBoard({ deliveries, livreurs, toPlan }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignTarget, setAssignTarget] = useState("");
  const [showNewLivreur, setShowNewLivreur] = useState(false);
  const [newLivreurName, setNewLivreurName] = useState("");
  const [newLivreurPhone, setNewLivreurPhone] = useState("");
  const [feeDrafts, setFeeDrafts] = useState<Record<string, string>>({});
  const [planSelected, setPlanSelected] = useState<Set<string>>(new Set());
  const [planDate, setPlanDate] = useState(tomorrowMorning);
  const [planLivreur, setPlanLivreur] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const todayKey = dayLabel(new Date());
  // Les livraisons disparues (livrées hier, annulées…) ne restent pas sélectionnées
  const visibleSelected = [...selected].filter((id) => deliveries.some((d) => d.id === id));
  const grouped = groupBy(deliveries, (d) => dayLabel(d.scheduledAt));
  const pendingCount = deliveries.filter((d) => d.status === "PLANIFIEE" || d.status === "EN_COURS").length;
  const unassignedCount = deliveries.filter((d) => !d.livreurId && d.status !== "LIVREE").length;

  function act(action: () => Promise<unknown>, success?: string, after?: () => void) {
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
        after?.();
        if (success) setMessage({ tone: "ok", text: success });
        router.refresh();
      } catch (err) {
        setMessage({ tone: "error", text: err instanceof Error ? err.message : "Erreur." });
      }
    });
  }

  function toggle(set: React.Dispatch<React.SetStateAction<Set<string>>>, ids: string[]) {
    set((prev) => {
      const next = new Set(prev);
      const all = ids.every((id) => next.has(id));
      ids.forEach((id) => (all ? next.delete(id) : next.add(id)));
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setAssignTarget("");
    setShowNewLivreur(false);
  }

  function applyAssignment(livreurId: string | null) {
    const ids = visibleSelected;
    const name = livreurId ? livreurs.find((l) => l.id === livreurId)?.name : null;
    act(
      () => assignLivreur(ids, livreurId),
      name ? `${ids.length} livraison(s) attribuée(s) à ${name}.` : `Attribution retirée (${ids.length}).`,
      clearSelection,
    );
  }

  function handleCreateAndAssign() {
    const name = newLivreurName.trim();
    const phone = newLivreurPhone.trim();
    if (!name || !phone) {
      setMessage({ tone: "error", text: "Nom et téléphone du livreur requis." });
      return;
    }
    const formData = new FormData();
    formData.set("name", name);
    formData.set("phone", phone);
    const ids = visibleSelected;
    act(
      async () => {
        const livreur = await createLivreur(formData);
        await assignLivreur(ids, livreur.id);
      },
      `Livreur ${name} créé et assigné.`,
      () => {
        setNewLivreurName("");
        setNewLivreurPhone("");
        clearSelection();
      },
    );
  }

  /** Regroupe la sélection en une tournée du livreur choisi (un déplacement payé une fois). */
  function handleCreateRun() {
    if (!assignTarget) {
      setMessage({ tone: "error", text: "Choisissez le livreur de la tournée." });
      return;
    }
    const ids = visibleSelected;
    setMessage(null);
    startTransition(async () => {
      try {
        const run = await createRun(ids, assignTarget);
        router.push(`/admin/livraisons/tournees/${run.id}`);
      } catch (err) {
        setMessage({ tone: "error", text: err instanceof Error ? err.message : "Erreur lors de la création de la tournée." });
      }
    });
  }

  function saveFee(delivery: DeliveryRow) {
    const draft = feeDrafts[delivery.id];
    if (draft === undefined || draft === String(delivery.deliveryFee)) return;
    const fee = Number(draft);
    if (!Number.isFinite(fee) || fee < 0) return;
    act(
      () => updateDeliveryFee(delivery.id, fee),
      undefined,
      () => setFeeDrafts((prev) => {
        const next = { ...prev };
        delete next[delivery.id];
        return next;
      }),
    );
  }

  function handlePlan() {
    const ids = [...planSelected].filter((id) => toPlan.some((o) => o.id === id));
    if (ids.length === 0 || !planDate) return;
    act(
      () => planDeliveries(ids, new Date(planDate).toISOString(), planLivreur || null),
      `${ids.length} livraison(s) planifiée(s).`,
      () => setPlanSelected(new Set()),
    );
  }

  return (
    <div className="space-y-6 pb-40 md:pb-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Livraisons</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {pendingCount} en attente
            {unassignedCount > 0 && <span className="text-amber-600"> · {unassignedCount} sans livreur</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <Link href="/admin/livraisons/tournees" className="text-[var(--color-accent)]">
            Tournées →
          </Link>
          <Link href="/admin/livraisons/reglages" className="text-[var(--color-accent)]">
            Zones & tarifs →
          </Link>
          <Link href="/admin/livreurs" className="text-[var(--color-accent)]">
            Livreurs →
          </Link>
        </div>
      </div>

      {message && (
        <p
          className={`rounded-xl border px-4 py-3 text-sm ${
            message.tone === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </p>
      )}

      {/* Commandes à planifier */}
      {toPlan.length > 0 && (
        <section className="overflow-hidden rounded-xl border border-amber-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2">
            <h2 className="text-sm font-semibold text-amber-900">
              À planifier · {toPlan.length} commande{toPlan.length > 1 ? "s" : ""} à livrer sans date
            </h2>
            <button
              type="button"
              onClick={() => toggle(setPlanSelected, toPlan.map((o) => o.id))}
              className="text-xs text-amber-900 underline"
            >
              Tout sélectionner
            </button>
          </div>
          <ul className="divide-y divide-[var(--color-border)]">
            {toPlan.map((order) => {
              const cfg = ORDER_STATUS_CONFIG[order.status as OrderStatus];
              const fee = formatFeeRange(order.feeMin, order.feeMax);
              return (
                <li key={order.id} className="flex items-center gap-3 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={planSelected.has(order.id)}
                    onChange={() => toggle(setPlanSelected, [order.id])}
                    aria-label={`Planifier #${order.number}`}
                    className="shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/commandes/${order.id}`} className="text-sm font-medium hover:text-[var(--color-accent)]">
                        #{order.number} — {order.name}
                      </Link>
                      {cfg && <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>}
                    </div>
                    <p className="truncate text-xs text-[var(--color-muted)]">
                      📍 {order.address}
                      {fee ? ` · frais annoncés ${fee}` : " · frais à confirmer"}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
          {planSelected.size > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border)] bg-[var(--color-sand)] px-4 py-3">
              <input
                type="datetime-local"
                value={planDate}
                onChange={(e) => setPlanDate(e.target.value)}
                aria-label="Date de livraison"
                className={selectClass}
              />
              <select value={planLivreur} onChange={(e) => setPlanLivreur(e.target.value)} aria-label="Livreur" className={selectClass}>
                <option value="">Livreur : plus tard</option>
                {livreurs.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={handlePlan}
                disabled={isPending || !planDate}
                className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                Planifier ({planSelected.size})
              </button>
              <span className="text-xs text-[var(--color-muted)]">Frais = bas de la fourchette annoncée, modifiable ensuite.</span>
            </div>
          )}
        </section>
      )}

      {grouped.size === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 text-sm text-[var(--color-muted)]">
          Aucune livraison planifiée.{" "}
          {toPlan.length === 0 && (
            <Link href="/admin/commandes" className="text-[var(--color-accent)] hover:underline">
              Voir les commandes →
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()].map(([day, dayDeliveries]) => {
            const isToday = day === todayKey;
            const byZone = groupBy(dayDeliveries, (d) => d.order.zone);

            return (
              <div key={day}>
                <div className="mb-3 flex items-center gap-3">
                  <h2 className="font-semibold capitalize">
                    {day}
                    {isToday && (
                      <span className="ml-2 rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[10px] font-medium normal-case text-white">
                        Aujourd&apos;hui
                      </span>
                    )}
                  </h2>
                  <span className="text-sm text-[var(--color-muted)]">
                    {dayDeliveries.length} livraison{dayDeliveries.length > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="space-y-3">
                  {[...byZone.entries()].map(([zone, items]) => {
                    const ids = items.map((d) => d.id);
                    const allSelected = ids.every((id) => selected.has(id));

                    return (
                      <div key={zone} className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
                        <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] bg-[var(--color-sand)] px-4 py-2">
                          <label className="flex min-w-0 items-center gap-2">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={() => toggle(setSelected, ids)}
                              title="Tout sélectionner dans ce quartier"
                            />
                            <span className="truncate text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                              📍 {zone}
                            </span>
                          </label>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-xs text-[var(--color-muted)]">
                              {items.length} arrêt{items.length > 1 ? "s" : ""}
                            </span>
                            <QuartierCopyButton
                              quartier={zone}
                              date={day}
                              deliveries={items.map((d) => ({
                                orderNumber: d.order.number,
                                orderName: d.order.name,
                                orderPhone: d.order.phone,
                                scheduledAt: d.scheduledAt,
                                finalTotal: Math.max(d.order.finalTotal - d.order.depositAmount, 0),
                                deliveryFee: d.deliveryFee,
                                notes: [d.order.address !== zone ? d.order.address : null, d.notes].filter(Boolean).join(" · ") || null,
                              }))}
                            />
                          </div>
                        </div>

                        <ul className="divide-y divide-[var(--color-border)]">
                          {items.map((delivery) => {
                            const cfg = DELIVERY_STATUS_CONFIG[delivery.status as DeliveryStatus];
                            const time = delivery.scheduledAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

                            return (
                              <li key={delivery.id} className="flex items-start gap-3 px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selected.has(delivery.id)}
                                  onChange={() => toggle(setSelected, [delivery.id])}
                                  aria-label={`Sélectionner #${delivery.order.number}`}
                                  className="mt-1 shrink-0"
                                />

                                <span className="mt-0.5 w-11 shrink-0 text-xs font-medium text-[var(--color-muted)]">{time}</span>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <Link
                                      href={`/admin/commandes/${delivery.order.id}`}
                                      className="text-sm font-medium hover:text-[var(--color-accent)]"
                                    >
                                      #{delivery.order.number} — {delivery.order.name}
                                    </Link>
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
                                  </div>
                                  {delivery.order.address !== zone && (
                                    <p className="truncate text-xs text-[var(--color-muted)]">{delivery.order.address}</p>
                                  )}
                                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--color-muted)]">
                                    <span>À encaisser : {gnf(toCollect(delivery))}</span>
                                    <label className="flex items-center gap-1">
                                      · Frais
                                      <input
                                        type="number"
                                        min="0"
                                        step="500"
                                        value={feeDrafts[delivery.id] ?? String(delivery.deliveryFee)}
                                        disabled={delivery.runSettled}
                                        onChange={(e) => setFeeDrafts((prev) => ({ ...prev, [delivery.id]: e.target.value }))}
                                        onBlur={() => saveFee(delivery)}
                                        className="w-20 rounded border border-[var(--color-border)] bg-white px-1.5 py-0.5 text-xs"
                                      />
                                    </label>
                                    {delivery.livreur ? (
                                      <span>· 🛵 {delivery.livreur.name}</span>
                                    ) : (
                                      <span className="font-medium text-amber-600">· Sans livreur</span>
                                    )}
                                    {delivery.runId && (
                                      <Link href={`/admin/livraisons/tournees/${delivery.runId}`} className="text-indigo-600 hover:underline">
                                        · 🗺 Tournée{delivery.runSettled ? " réglée" : ""}
                                      </Link>
                                    )}
                                    {delivery.notes && <span className="break-words">· {delivery.notes}</span>}
                                  </div>
                                </div>

                                <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                                  <a
                                    href={buildWhatsAppUrl(delivery.order.phone)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100"
                                    title="Contacter sur WhatsApp"
                                  >
                                    💬
                                  </a>
                                  {delivery.status === "LIVREE" ? (
                                    <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">✓ Livrée</span>
                                  ) : (
                                    <LivraisonStatusButton deliveryId={delivery.id} currentStatus={delivery.status as DeliveryStatus} />
                                  )}
                                </div>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Barre d'attribution flottante, au-dessus de la navigation mobile (z-50) qu'elle remplace le temps de la sélection */}
      {visibleSelected.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-[60] border-t border-[var(--color-border)] bg-white p-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {visibleSelected.length} livraison{visibleSelected.length > 1 ? "s" : ""}
            </span>

            {!showNewLivreur ? (
              <>
                <select value={assignTarget} onChange={(e) => setAssignTarget(e.target.value)} aria-label="Livreur" className={selectClass}>
                  <option value="">Choisir un livreur…</option>
                  {livreurs.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => applyAssignment(assignTarget)}
                  disabled={!assignTarget || isPending}
                  className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  Assigner
                </button>
                <button
                  type="button"
                  onClick={handleCreateRun}
                  disabled={!assignTarget || isPending}
                  className="rounded-full border border-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent)] disabled:opacity-40"
                  title="Regrouper en un seul déplacement, payé au livreur selon la distance"
                >
                  Créer une tournée
                </button>
                <button type="button" onClick={() => setShowNewLivreur(true)} className="text-sm text-[var(--color-accent)] hover:underline">
                  + Nouveau livreur
                </button>
                <button
                  type="button"
                  onClick={() => applyAssignment(null)}
                  disabled={isPending}
                  className="text-sm text-[var(--color-muted)] hover:text-red-500"
                >
                  Retirer l&apos;attribution
                </button>
              </>
            ) : (
              <>
                <input
                  value={newLivreurName}
                  onChange={(e) => setNewLivreurName(e.target.value)}
                  placeholder="Nom du livreur"
                  className="w-32 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
                />
                <input
                  value={newLivreurPhone}
                  onChange={(e) => setNewLivreurPhone(e.target.value)}
                  placeholder="Téléphone"
                  className="w-32 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={handleCreateAndAssign}
                  disabled={isPending}
                  className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  Créer et assigner
                </button>
                <button type="button" onClick={() => setShowNewLivreur(false)} className="text-sm text-[var(--color-muted)]">
                  Annuler
                </button>
              </>
            )}

            <button type="button" onClick={clearSelection} className="ml-auto text-sm text-[var(--color-muted)] hover:text-red-500">
              ✕ Désélectionner
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
