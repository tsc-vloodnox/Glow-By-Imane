"use client";

import { useState, useTransition } from "react";

import { unwrapAction } from "@/lib/action-result";
import { updateWholesaleLines as updateWholesaleLinesAction } from "../actions";

// Action serveur : lève une Error au message lisible en cas d'échec (cf. lib/action-result.ts)
const updateWholesaleLines = unwrapAction(updateWholesaleLinesAction);

type Line = { id: string; label: string; quantity: number; unitPrice: number; requestedUnitPrice: number | null };

type Props = {
  orderId: string;
  lines: Line[];
  /** Stock réservé (commande confirmée) : quantités figées */
  quantitiesLocked: boolean;
  /** Commande livrée ou annulée : plus rien de modifiable */
  readOnly: boolean;
};

const formatGNF = (value: number) => `${value.toLocaleString("fr-GN")} GNF`;

export function WholesaleLinesEditor({ orderId, lines, quantitiesLocked, readOnly }: Props) {
  const [draft, setDraft] = useState(lines);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty = draft.some((line, i) => line.quantity !== lines[i].quantity || line.unitPrice !== lines[i].unitPrice);
  const total = draft.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  const hasRequested = draft.some((line) => line.requestedUnitPrice);
  const allRequestedApplied = draft.every((line) => !line.requestedUnitPrice || line.unitPrice === line.requestedUnitPrice);

  /** Reprend le prix proposé par le revendeur sur chaque ligne qui en a un (à enregistrer ensuite). */
  function acceptRequestedPrices() {
    setSaved(false);
    setDraft((prev) => prev.map((line) => (line.requestedUnitPrice ? { ...line, unitPrice: line.requestedUnitPrice } : line)));
  }

  function update(id: string, field: "quantity" | "unitPrice", value: string) {
    const n = Math.max(0, Math.floor(Number(value.replace(/\s/g, "")) || 0));
    setSaved(false);
    setDraft((prev) => prev.map((line) => (line.id === id ? { ...line, [field]: n } : line)));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      try {
        await updateWholesaleLines(orderId, draft.map(({ id, quantity, unitPrice }) => ({ id, quantity, unitPrice })));
        setSaved(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {error ? <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      {hasRequested && !readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-indigo-50 p-2.5 text-xs text-indigo-800">
          <span>Le revendeur a proposé ses prix sur certaines lignes.</span>
          <button type="button" onClick={acceptRequestedPrices} disabled={allRequestedApplied}
            className="rounded-full bg-indigo-600 px-3 py-1 font-medium text-white disabled:opacity-40">
            Accepter les prix souhaités
          </button>
        </div>
      )}
      <ul className="divide-y divide-[var(--color-border)]">
        {draft.map((line) => (
          <li key={line.id} className="flex flex-wrap items-center gap-2 py-2.5">
            <span className="min-w-0 flex-1 basis-40 text-sm">{line.label}</span>
            <label className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
              Qté
              <input type="number" inputMode="numeric" min={1} value={line.quantity}
                disabled={readOnly || quantitiesLocked}
                onChange={(e) => update(line.id, "quantity", e.target.value)}
                className="w-16 rounded-lg border border-[var(--color-border)] px-2 py-1 text-right text-sm text-[var(--foreground)] disabled:bg-[var(--color-sand)]" />
            </label>
            <label className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
              × PU
              <input type="number" inputMode="numeric" min={0} value={line.unitPrice}
                disabled={readOnly}
                onChange={(e) => update(line.id, "unitPrice", e.target.value)}
                className="w-24 rounded-lg border border-[var(--color-border)] px-2 py-1 text-right text-sm text-[var(--foreground)] disabled:bg-[var(--color-sand)]" />
            </label>
            <span className="w-28 text-right text-sm font-medium tabular-nums">{formatGNF(line.quantity * line.unitPrice)}</span>
            {line.requestedUnitPrice ? (
              <p className="basis-full text-right text-xs text-indigo-700">
                Souhaité : {formatGNF(line.requestedUnitPrice)} / u
                {line.unitPrice > 0 && line.requestedUnitPrice !== line.unitPrice
                  ? ` (${line.requestedUnitPrice < line.unitPrice ? "−" : "+"}${Math.round((Math.abs(line.unitPrice - line.requestedUnitPrice) / line.unitPrice) * 100)} % par rapport à votre prix)`
                  : " ✓ accepté"}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-[var(--color-muted)]">
          {quantitiesLocked
            ? "Stock réservé : seuls les prix restent modifiables."
            : "Prix indicatifs de la demande : ajustez-les selon l'accord."}
        </span>
        <div className="flex items-center gap-3">
          <span className="font-semibold tabular-nums">{formatGNF(total)}</span>
          {!readOnly && (
            <button type="button" onClick={save} disabled={!dirty || isPending}
              className="rounded-full bg-[var(--color-accent)] px-4 py-1.5 font-medium text-white disabled:opacity-40">
              {isPending ? "…" : saved && !dirty ? "Enregistré ✓" : "Enregistrer les prix"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
