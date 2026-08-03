"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";

import { DELIVERY_STATUS_CONFIG, type DeliveryStatus } from "@/lib/order-status";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { assignLivreur, createLivreur, updateDeliveryFee } from "../actions";
import { LivraisonStatusButton } from "./LivraisonStatusButton";
import { QuartierCopyButton } from "./QuartierCopyButton";

type DeliveryRow = {
  id: string;
  scheduledAt: Date;
  status: string;
  notes: string | null;
  deliveryFee: number;
  livreurId: string | null;
  livreur: { id: string; name: string } | null;
  order: {
    id: string;
    number: number;
    name: string;
    phone: string;
    quartier: string;
    finalTotal: number;
  };
};

type LivreurOption = {
  id: string;
  name: string;
};

type LivraisonsBoardProps = {
  initialDeliveries: DeliveryRow[];
  initialLivreurs: LivreurOption[];
};

function groupByDay(deliveries: DeliveryRow[]) {
  const map = new Map<string, DeliveryRow[]>();
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

function groupByQuartier(deliveries: DeliveryRow[]) {
  const map = new Map<string, DeliveryRow[]>();
  for (const d of deliveries) {
    const q = d.order.quartier;
    if (!map.has(q)) map.set(q, []);
    map.get(q)!.push(d);
  }
  return map;
}

export function LivraisonsBoard({ initialDeliveries, initialLivreurs }: LivraisonsBoardProps) {
  const [isPending, startTransition] = useTransition();
  const [deliveries, setDeliveries] = useState(initialDeliveries);
  const [livreurs, setLivreurs] = useState(initialLivreurs);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [assignTarget, setAssignTarget] = useState("");
  const [showNewLivreur, setShowNewLivreur] = useState(false);
  const [newLivreurName, setNewLivreurName] = useState("");
  const [newLivreurPhone, setNewLivreurPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const todayKey = today.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  const grouped = groupByDay(deliveries);
  const pendingCount = deliveries.filter((d) => d.status === "PLANIFIEE" || d.status === "EN_COURS").length;

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectGroup(ids: string[]) {
    setSelected((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setAssignTarget("");
    setShowNewLivreur(false);
  }

  function applyAssignment(livreurId: string | null) {
    const ids = [...selected];
    setError(null);
    startTransition(async () => {
      try {
        await assignLivreur(ids, livreurId);
        const livreur = livreurId ? livreurs.find((l) => l.id === livreurId) ?? null : null;
        setDeliveries((prev) =>
          prev.map((d) => (ids.includes(d.id) ? { ...d, livreurId, livreur } : d)),
        );
        clearSelection();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de l'attribution.");
      }
    });
  }

  function handleAssignExisting() {
    if (!assignTarget) return;
    applyAssignment(assignTarget);
  }

  function handleUnassign() {
    applyAssignment(null);
  }

  function handleCreateAndAssign() {
    const name = newLivreurName.trim();
    const phone = newLivreurPhone.trim();
    if (!name || !phone) {
      setError("Nom et téléphone du livreur requis.");
      return;
    }

    const formData = new FormData();
    formData.set("name", name);
    formData.set("phone", phone);

    const ids = [...selected];
    setError(null);
    startTransition(async () => {
      try {
        const livreur = await createLivreur(formData);
        setLivreurs((prev) => [...prev, { id: livreur.id, name: livreur.name }]);
        await assignLivreur(ids, livreur.id);
        setDeliveries((prev) =>
          prev.map((d) => (ids.includes(d.id) ? { ...d, livreurId: livreur.id, livreur: { id: livreur.id, name: livreur.name } } : d)),
        );
        setNewLivreurName("");
        setNewLivreurPhone("");
        clearSelection();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de la création du livreur.");
      }
    });
  }

  function handleFeeChange(deliveryId: string, fee: number) {
    // Mise à jour optimiste immédiate pour un input fluide
    setDeliveries((prev) => prev.map((d) => (d.id === deliveryId ? { ...d, deliveryFee: fee } : d)));
  }

  function handleFeeSave(deliveryId: string, fee: number) {
    if (!Number.isFinite(fee) || fee < 0) return;
    startTransition(async () => {
      try {
        await updateDeliveryFee(deliveryId, fee);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement des frais.");
      }
    });
  }


  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Livraisons</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {pendingCount} en attente · vue des 7 prochains jours
          </p>
        </div>
        <Link href="/admin/livreurs" className="text-sm text-[var(--color-accent)]">
          Gérer les livreurs →
        </Link>
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

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
            const byQuartier = groupByQuartier(dayDeliveries);

            return (
              <div key={dayLabel}>
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

                <div className="space-y-3">
                  {[...byQuartier.entries()].map(([quartier, items]) => {
                    const ids = items.map((d) => d.id);
                    const allSelected = ids.every((id) => selected.has(id));

                    return (
                      <div
                        key={quartier}
                        className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white"
                      >
                        <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-sand)] px-4 py-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={allSelected}
                              onChange={() => toggleSelectGroup(ids)}
                              title="Tout sélectionner dans ce quartier"
                            />
                            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                              📍 {quartier}
                            </span>
                          </div>
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
                                finalTotal: d.order.finalTotal,
                                deliveryFee: d.deliveryFee,
                                notes: d.notes,
                              }))}
                            />
                          </div>
                        </div>

                        <ul className="divide-y divide-[var(--color-border)]">
                          {items.map((delivery) => {
                            const cfg = DELIVERY_STATUS_CONFIG[delivery.status as DeliveryStatus];
                            const time = delivery.scheduledAt.toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            });
                            const totalToCollect = delivery.order.finalTotal + delivery.deliveryFee;

                            return (
                              <li key={delivery.id} className="flex items-center gap-3 px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={selected.has(delivery.id)}
                                  onChange={() => toggleSelect(delivery.id)}
                                  className="shrink-0"
                                />

                                <span className="w-12 shrink-0 text-center text-xs font-medium text-[var(--color-muted)]">
                                  {time}
                                </span>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
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
                                    <span>À encaisser : {totalToCollect.toLocaleString("fr-GN")} GNF</span>
                                    <span className="flex items-center gap-1">
                                      · Frais livraison
                                      <input
                                        type="number"
                                        min="0"
                                        value={delivery.deliveryFee}
                                        onChange={(e) => handleFeeChange(delivery.id, Number(e.target.value))}
                                        onBlur={(e) => handleFeeSave(delivery.id, Number(e.target.value))}
                                        className="w-16 rounded border border-[var(--color-border)] bg-white px-1.5 py-0.5 text-xs"
                                      />
                                    </span>
                                    {delivery.livreur ? (
                                      <span>· 🛵 {delivery.livreur.name}</span>
                                    ) : (
                                      <span className="text-amber-600">· Non attribué</span>
                                    )}
                                    {delivery.notes && <span>· {delivery.notes}</span>}
                                  </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                  <a
                                    href={buildWhatsAppUrl(delivery.order.phone)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700 hover:bg-green-100"
                                    title="Contacter sur WhatsApp"
                                  >
                                    💬
                                  </a>

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
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Barre d'attribution flottante */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-border)] bg-white p-3 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {selected.size} commande{selected.size > 1 ? "s" : ""} sélectionnée{selected.size > 1 ? "s" : ""}
            </span>

            {!showNewLivreur ? (
              <>
                <select
                  value={assignTarget}
                  onChange={(e) => setAssignTarget(e.target.value)}
                  className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
                >
                  <option value="">Choisir un livreur…</option>
                  {livreurs.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAssignExisting}
                  disabled={!assignTarget || isPending}
                  className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                >
                  Assigner
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewLivreur(true)}
                  className="text-sm text-[var(--color-accent)] hover:underline"
                >
                  + Nouveau livreur
                </button>
                <button
                  type="button"
                  onClick={handleUnassign}
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
                <button
                  type="button"
                  onClick={() => setShowNewLivreur(false)}
                  className="text-sm text-[var(--color-muted)]"
                >
                  Annuler
                </button>
              </>
            )}

            <button
              type="button"
              onClick={clearSelection}
              className="ml-auto text-sm text-[var(--color-muted)] hover:text-red-500"
            >
              ✕ Désélectionner
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
