"use client";

import { useState, useTransition } from "react";
import { updateOrderDiscount } from "../actions";

type Props = {
  orderId: string;
  estimatedTotal: number;
  discountAmount: number;
  discountReason: string | null;
  finalTotal: number;
};

export function OrderDiscountEditor({
  orderId,
  estimatedTotal,
  discountAmount,
  discountReason,
  finalTotal,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [localDiscount, setLocalDiscount] = useState(discountAmount);
  const [localReason, setLocalReason] = useState(discountReason ?? "");
  const [localFinal, setLocalFinal] = useState(finalTotal);

  function handleDiscountChange(value: number) {
    const clamped = Math.max(0, Math.min(value, estimatedTotal));
    setLocalDiscount(clamped);
    setLocalFinal(estimatedTotal - clamped);
  }

  function handleSave() {
    const formData = new FormData();
    formData.set("discountAmount", String(localDiscount));
    formData.set("discountReason", localReason);
    startTransition(async () => {
      await updateOrderDiscount(orderId, formData);
      setEditing(false);
    });
  }

  function handleCancel() {
    setLocalDiscount(discountAmount);
    setLocalReason(discountReason ?? "");
    setLocalFinal(finalTotal);
    setEditing(false);
  }

  return (
    <div className="space-y-3">
      {/* Récap totaux */}
      <dl className="space-y-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-[var(--color-muted)]">Total articles</dt>
          <dd>{estimatedTotal.toLocaleString("fr-GN")} GNF</dd>
        </div>

        {localDiscount > 0 && (
          <div className="flex justify-between text-amber-700">
            <dt>
              Remise
              {localReason && (
                <span className="ml-1 font-normal text-[var(--color-muted)]">
                  ({localReason})
                </span>
              )}
            </dt>
            <dd>− {localDiscount.toLocaleString("fr-GN")} GNF</dd>
          </div>
        )}

        <div className="flex justify-between border-t border-[var(--color-border)] pt-1.5 font-semibold">
          <dt>Total final</dt>
          <dd className="text-[var(--color-accent)]">
            {localFinal.toLocaleString("fr-GN")} GNF
          </dd>
        </div>
      </dl>

      {/* Éditeur */}
      {!editing ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs text-[var(--color-muted)] hover:text-[var(--color-accent)]"
        >
          {discountAmount > 0 ? "✏️ Modifier la remise" : "+ Appliquer une remise"}
        </button>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-3">
          <p className="text-xs font-medium text-amber-800">Remise sur cette commande</p>

          {/* Montant */}
          <label className="block space-y-1">
            <span className="text-xs text-amber-700">Montant de la remise (GNF)</span>
            <input
              type="number"
              min="0"
              max={estimatedTotal}
              value={localDiscount}
              onChange={(e) => handleDiscountChange(Number(e.target.value))}
              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
              placeholder="0"
            />
          </label>

          {/* Aperçu en temps réel */}
          <p className="text-xs text-amber-700">
            Total après remise :{" "}
            <span className="font-semibold">
              {localFinal.toLocaleString("fr-GN")} GNF
            </span>
          </p>

          {/* Raison */}
          <label className="block space-y-1">
            <span className="text-xs text-amber-700">Raison (optionnel)</span>
            <input
              type="text"
              value={localReason}
              onChange={(e) => setLocalReason(e.target.value)}
              placeholder="Ex : accord WhatsApp, commande groupée, VIP…"
              className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="rounded-full bg-amber-600 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-60"
            >
              {isPending ? "Enregistrement…" : "Appliquer"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="text-xs text-[var(--color-muted)]"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
