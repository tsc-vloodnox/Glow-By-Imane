"use client";

import { useTransition } from "react";

import { type DeliveryStatus } from "@/lib/order-status";
import { updateDeliveryStatus } from "../actions";

type Props = {
  deliveryId: string;
  currentStatus: DeliveryStatus;
};

export function LivraisonStatusButton({ deliveryId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();

  // Action principale selon le statut actuel
  const primaryAction: { label: string; next: DeliveryStatus; style: string } | null =
    currentStatus === "PLANIFIEE"
      ? {
          label: "Marquer livrée",
          next: "LIVREE",
          style: "bg-green-600 text-white hover:bg-green-700",
        }
      : currentStatus === "EN_COURS"
      ? {
          label: "✓ Livrée",
          next: "LIVREE",
          style: "bg-green-600 text-white hover:bg-green-700",
        }
      : currentStatus === "REPORTEE"
      ? {
          label: "Replanifier → En cours",
          next: "EN_COURS",
          style: "bg-purple-600 text-white hover:bg-purple-700",
        }
      : null;

  if (!primaryAction) return null;

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(() => updateDeliveryStatus(deliveryId, primaryAction.next))
      }
      className={`rounded-full px-3 py-1 text-xs font-medium transition-opacity disabled:opacity-50 ${primaryAction.style}`}
    >
      {isPending ? "…" : primaryAction.label}
    </button>
  );
}
