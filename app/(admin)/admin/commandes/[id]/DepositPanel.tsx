"use client";

import { useState, useTransition } from "react";

import { unwrapAction } from "@/lib/action-result";
import { updateOrderDeposit as updateOrderDepositAction } from "../actions";

// Action serveur : lève une Error au message lisible en cas d'échec (cf. lib/action-result.ts)
const updateOrderDeposit = unwrapAction(updateOrderDepositAction);

type Props = {
  orderId: string;
  finalTotal: number;
  deliveryFee: number;
  depositAmount: number;
  depositPaidAt: Date | null;
  depositNote: string | null;
};

const formatGNF = (value: number) => `${value.toLocaleString("fr-GN")} GNF`;
const toDateInput = (date: Date | null) => (date ? new Date(date).toISOString().slice(0, 10) : "");

export function DepositPanel({ orderId, finalTotal, deliveryFee, depositAmount, depositPaidAt, depositNote }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const remaining = Math.max(finalTotal + deliveryFee - depositAmount, 0);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateOrderDeposit(orderId, formData);
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-white p-4">
      <h2 className="mb-1 font-medium">Acompte</h2>
      <p className="mb-3 text-xs text-[var(--color-muted)]">Suivi interne, encaissé hors application.</p>
      <dl className="mb-3 space-y-1 text-sm">
        <div className="flex justify-between"><dt className="text-[var(--color-muted)]">Commande</dt><dd className="tabular-nums">{formatGNF(finalTotal)}</dd></div>
        {deliveryFee > 0 && (
          <div className="flex justify-between"><dt className="text-[var(--color-muted)]">Livraison</dt><dd className="tabular-nums">{formatGNF(deliveryFee)}</dd></div>
        )}
        <div className="flex justify-between"><dt className="text-[var(--color-muted)]">Acompte reçu</dt><dd className="tabular-nums">− {formatGNF(depositAmount)}</dd></div>
        <div className="flex justify-between border-t border-[var(--color-border)] pt-1 font-semibold">
          <dt>Reste à encaisser</dt><dd className="tabular-nums text-[var(--color-accent)]">{formatGNF(remaining)}</dd>
        </div>
      </dl>
      <form onSubmit={handleSubmit} className="space-y-2 text-sm">
        {error ? <p className="rounded-lg bg-red-50 p-2 text-red-700">{error}</p> : null}
        <div className="flex gap-2">
          <input name="depositAmount" type="number" inputMode="numeric" min={0} defaultValue={depositAmount || ""}
            placeholder="Montant (GNF)" className="min-w-0 flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2" />
          <input name="depositPaidAt" type="date" defaultValue={toDateInput(depositPaidAt)}
            className="rounded-lg border border-[var(--color-border)] px-2 py-2" />
        </div>
        <input name="depositNote" maxLength={500} defaultValue={depositNote ?? ""}
          placeholder="Note (ex : Orange Money, réf. …)" className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2" />
        <button disabled={isPending} className="rounded-full bg-[var(--color-accent)] px-4 py-2 font-medium text-white disabled:opacity-60">
          {isPending ? "…" : saved ? "Enregistré ✓" : "Enregistrer l'acompte"}
        </button>
      </form>
    </section>
  );
}
