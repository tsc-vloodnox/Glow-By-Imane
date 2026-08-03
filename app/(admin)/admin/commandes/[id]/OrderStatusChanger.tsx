"use client";

import { useTransition } from "react";

import { ORDER_STATUS_CONFIG, type OrderStatus } from "@/lib/order-status";
import { updateOrderStatus } from "../actions";

type Props = {
  orderId: string;
  currentStatus: OrderStatus;
};

export function OrderStatusChanger({ orderId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
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
    <div className="flex flex-wrap gap-2">
      {nextStatuses.map((next) => {
        const nextCfg = ORDER_STATUS_CONFIG[next];
        const isCancel = next === "ANNULEE";

        return (
          <button
            key={next}
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(() => updateOrderStatus(orderId, next))
            }
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
  );
}
