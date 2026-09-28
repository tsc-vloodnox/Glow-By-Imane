"use client";

import { useState, useTransition } from "react";

import { ORDER_STATUS_CONFIG, type OrderStatus } from "@/lib/order-status";
import { updateOrderStatus as updateOrderStatusAction } from "../actions";
import { unwrapAction } from "@/lib/action-result";

// Actions serveur : lèvent une Error au message lisible en cas d'échec (cf. lib/action-result.ts)
const updateOrderStatus = unwrapAction(updateOrderStatusAction);

type Props = {
  orderId: string;
  currentStatus: OrderStatus;
};

export function OrderStatusChanger({ orderId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cfg = ORDER_STATUS_CONFIG[currentStatus];
  const nextStatuses = cfg.next as readonly OrderStatus[];

  if (nextStatuses.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted)]">
        Ce statut est final, aucune transition possible.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {nextStatuses.map((next) => {
          const nextCfg = ORDER_STATUS_CONFIG[next];
          const isCancel = next === "ANNULEE";

          return (
            <button
              key={next}
              type="button"
              disabled={isPending}
              onClick={() => {
                if (isCancel && !window.confirm("Annuler cette commande ? Les articles réservés seront remis en stock.")) return;
                setError(null);
                startTransition(async () => {
                  try {
                    await updateOrderStatus(orderId, next);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Erreur lors du changement de statut.");
                  }
                });
              }}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50 ${
                isCancel
                  ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                  : "border-[var(--color-accent)] bg-[var(--color-accent)] text-white hover:opacity-90"
              }`}
            >
              {isPending ? "…" : `→ ${nextCfg.label}`}
            </button>
          );
        })}
      </div>
    </div>
  );
}
