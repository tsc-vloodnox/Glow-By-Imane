"use client";

import { useState, useTransition } from "react";

import { unwrapAction } from "@/lib/action-result";
import { updateCustomer as updateCustomerAction } from "../actions";

// Action serveur : lève une Error au message lisible en cas d'échec (cf. lib/action-result.ts)
const updateCustomer = unwrapAction(updateCustomerAction);

type Props = {
  customer: { id: string; name: string; businessName: string | null; isReseller: boolean; notes: string | null };
};

export function CustomerEditor({ customer }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await updateCustomer(customer.id, formData);
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-sm">
      {error ? <p className="rounded-lg bg-red-50 p-2 text-red-700">{error}</p> : null}
      <label className="block space-y-1">
        <span className="text-[var(--color-muted)]">Nom</span>
        <input name="name" defaultValue={customer.name} required maxLength={80}
          className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2" />
      </label>
      <label className="block space-y-1">
        <span className="text-[var(--color-muted)]">Boutique (revendeur)</span>
        <input name="businessName" defaultValue={customer.businessName ?? ""} maxLength={120}
          className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2" />
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" name="isReseller" defaultChecked={customer.isReseller} />
        <span>Revendeur</span>
      </label>
      <label className="block space-y-1">
        <span className="text-[var(--color-muted)]">Notes internes</span>
        <textarea name="notes" defaultValue={customer.notes ?? ""} rows={3} maxLength={2000}
          className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2" />
      </label>
      <button disabled={isPending}
        className="rounded-full bg-[var(--color-accent)] px-4 py-2 font-medium text-white disabled:opacity-60">
        {isPending ? "Enregistrement…" : saved ? "Enregistré ✓" : "Enregistrer"}
      </button>
    </form>
  );
}
