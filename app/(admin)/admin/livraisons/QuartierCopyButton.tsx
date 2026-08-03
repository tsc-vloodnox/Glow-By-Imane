"use client";

import { useState } from "react";

type Delivery = {
  orderNumber: number;
  orderName: string;
  orderPhone: string;
  scheduledAt: Date;
  finalTotal: number;
  deliveryFee: number;
  notes: string | null;
};

type Props = {
  quartier: string;
  deliveries: Delivery[];
  date: string; // label lisible ex: "lundi 30 juin"
};

export function QuartierCopyButton({ quartier, deliveries, date }: Props) {
  const [copied, setCopied] = useState(false);

  function buildMessage() {
    const lines = deliveries.map((d, i) => {
      const total = d.finalTotal + d.deliveryFee;
      return [
        `${i + 1}. ${d.orderName} — ${d.orderPhone}`,
        `   Total à encaisser : ${total.toLocaleString("fr-GN")} GNF`,
        d.notes ? `   📍 ${d.notes}` : null,
      ].filter(Boolean).join("\n");
    });

    return [
      `*Tournée ${quartier} — ${date}*`,
      `${deliveries.length} livraison${deliveries.length > 1 ? "s" : ""}`,
      "",
      ...lines,
      "",
      `_Glow by Imane 🌸_`,
    ].join("\n");
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(buildMessage());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback si clipboard non dispo
      const el = document.createElement("textarea");
      el.value = buildMessage();
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="rounded-full border border-[var(--color-border)] bg-white px-2.5 py-1 text-xs text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
    >
      {copied ? "✓ Copié !" : "📋 Copier liste livreur"}
    </button>
  );
}
