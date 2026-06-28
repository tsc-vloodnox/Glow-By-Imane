"use client";

import { useState, useTransition } from "react";
import { deleteAllOrders } from "./actions";
import type { OrderStatusValue } from "./actions";

const STATUS_OPTIONS: Array<{ value: OrderStatusValue | "TOUTES"; label: string }> = [
  { value: "TOUTES", label: "Toutes les commandes" },
  { value: "ANNULEE", label: "Annulées uniquement" },
  { value: "LIVREE", label: "Livrées uniquement" },
  { value: "NOUVELLE", label: "Nouvelles uniquement" },
];

export function BulkDeleteOrders() {
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<"idle" | "confirm1" | "confirm2">("idle");
  const [statusFilter, setStatusFilter] = useState<OrderStatusValue | "TOUTES">("ANNULEE");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);

  const REQUIRED_WORD = "SUPPRIMER";
  const canConfirm = confirmation === REQUIRED_WORD;

  function handleFinalDelete() {
    if (!canConfirm) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteAllOrders(statusFilter === "TOUTES" ? undefined : statusFilter);
        setStep("idle");
        setConfirmation("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de la suppression.");
        setStep("idle");
      }
    });
  }

  if (step === "idle") {
    return (
      <button
        type="button"
        onClick={() => setStep("confirm1")}
        className="text-sm text-red-500 hover:text-red-700"
      >
        Suppression en masse…
      </button>
    );
  }

  if (step === "confirm1") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
        <p className="text-sm font-medium text-red-800">Supprimer des commandes en masse</p>
        <p className="text-xs text-red-700">
          Cette action est irréversible. Les livraisons et articles associés seront également supprimés.
        </p>

        <label className="block space-y-1">
          <span className="text-xs font-medium text-red-700">Quelles commandes supprimer ?</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OrderStatusValue | "TOUTES")}
            className="w-full rounded-lg border border-red-200 bg-white px-3 py-2 text-sm"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setStep("confirm2")}
            className="rounded-full bg-red-600 px-4 py-2 text-xs font-medium text-white"
          >
            Continuer →
          </button>
          <button
            type="button"
            onClick={() => setStep("idle")}
            className="text-xs text-[var(--color-muted)]"
          >
            Annuler
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-red-400 bg-red-50 p-4 space-y-3">
      <p className="text-sm font-semibold text-red-800">⚠️ Confirmation finale</p>
      <p className="text-xs text-red-700">
        Vous allez supprimer{" "}
        <strong>
          {STATUS_OPTIONS.find((o) => o.value === statusFilter)?.label.toLowerCase()}
        </strong>
        . Cette action ne peut pas être annulée.
      </p>
      <p className="text-xs text-red-700">
        Tapez <strong>{REQUIRED_WORD}</strong> pour confirmer :
      </p>

      <input
        type="text"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        placeholder={REQUIRED_WORD}
        className="w-full rounded-lg border border-red-300 px-3 py-2 text-sm font-mono tracking-widest"
        autoFocus
      />

      {error && <p className="text-xs text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleFinalDelete}
          disabled={!canConfirm || isPending}
          className="rounded-full bg-red-700 px-4 py-2 text-xs font-medium text-white disabled:opacity-40"
        >
          {isPending ? "Suppression…" : "Supprimer définitivement"}
        </button>
        <button
          type="button"
          onClick={() => { setStep("idle"); setConfirmation(""); }}
          className="text-xs text-[var(--color-muted)]"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}
