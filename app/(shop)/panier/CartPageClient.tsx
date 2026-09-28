"use client";

import Link from "next/link";

import { useCart } from "../CartContext";
import { resolveDiscountedLineTotal, resolveDiscountedUnitPrice } from "@/lib/pricing";

export default function CartPageClient() {
  const { items, total, updateQuantity, removeItem, clear } = useCart();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-[var(--color-foreground)]">Panier</h1>
        {items.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Vider tout le panier ?")) clear();
            }}
            className="text-sm text-[var(--color-muted)]"
          >
            Vider
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center text-[var(--color-muted)]">
          Votre panier est vide pour le moment.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const atMax = item.quantity >= item.stock;
            const lineTotal = resolveDiscountedLineTotal(
              item.basePrice,
              item.activePromotions,
              item.packPrices,
              item.quantity,
              item.originalPrice,
            );
            const unitPrice = resolveDiscountedUnitPrice(
              item.basePrice,
              item.activePromotions,
              item.packPrices,
              item.quantity,
              item.originalPrice,
            );

            return (
              <div key={item.cartKey} className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--color-foreground)]">
                      {item.name}
                      {item.kind === "kit" ? (
                        <span className="ml-2 rounded-full bg-[var(--color-blush)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-accent)]">
                          Kit
                        </span>
                      ) : null}
                    </h2>
                    <p className="mt-1 text-sm text-[var(--color-accent)]">
                      {lineTotal.toLocaleString("fr-GN")} GNF
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.cartKey)}
                    className="text-xs text-[var(--color-muted)]"
                  >
                    Retirer
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-3 rounded-full border border-[var(--color-border)] px-2 py-1">
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.cartKey, item.quantity - 1)}
                      disabled={item.quantity <= 1}
                      aria-label="Diminuer la quantité"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-base text-[var(--color-accent)] disabled:opacity-30"
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-semibold">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateQuantity(item.cartKey, item.quantity + 1)}
                      disabled={atMax}
                      aria-label="Augmenter la quantité"
                      className="flex h-7 w-7 items-center justify-center rounded-full text-base text-[var(--color-accent)] disabled:opacity-30"
                    >
                      +
                    </button>
                  </div>
                  <span className="text-sm text-[var(--color-muted)]">
                    {unitPrice.toLocaleString("fr-GN")} GNF / unité
                  </span>
                </div>

                {atMax ? (
                  <p className="mt-2 text-[11px] text-amber-600">Quantité maximale disponible atteinte.</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-2xl bg-[var(--color-blush)] p-4 text-sm text-[var(--color-muted)]">
        <div className="flex items-center justify-between">
          <span>Total estimé</span>
          <span className="font-semibold text-[var(--color-accent)]">{total.toLocaleString("fr-GN")} GNF</span>
        </div>
        <p className="mt-2">Les frais de livraison seront confirmés par WhatsApp.</p>
      </div>

      {items.length > 0 ? (
        <Link
          href="/commande"
          className="block rounded-full bg-[var(--color-accent)] px-6 py-3 text-center text-sm font-medium text-white"
        >
          Continuer vers la commande
        </Link>
      ) : null}
    </div>
  );
}