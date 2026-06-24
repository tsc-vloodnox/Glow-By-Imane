"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { clearCart, getStoredCartItems, removeFromCart, updateCartQuantity, type CartItem } from "@/lib/cart";

export default function CartPageClient() {
  const [items, setItems] = useState<CartItem[]>(() => getStoredCartItems());

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );

  const refreshItems = () => {
    setItems(getStoredCartItems());
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-3xl text-[var(--color-foreground)]">Panier</h1>
        {items.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              clearCart();
              refreshItems();
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
          {items.map((item) => (
            <div key={item.productId} className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--color-foreground)]">{item.name}</h2>
                  <p className="mt-1 text-sm text-[var(--color-accent)]">
                    {(item.price * item.quantity).toLocaleString("fr-GN")} GNF
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    removeFromCart(item.productId);
                    refreshItems();
                  }}
                  className="text-xs text-[var(--color-muted)]"
                >
                  Retirer
                </button>
              </div>

              <div className="mt-3 flex items-center justify-between">
                <label className="text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
                  Quantité
                  <select
                    value={item.quantity}
                    onChange={(event) => {
                      updateCartQuantity(item.productId, Number(event.target.value));
                      refreshItems();
                    }}
                    className="ml-2 rounded-lg border border-[var(--color-border)] px-2 py-1 text-sm"
                  >
                    {Array.from({ length: 8 }, (_, index) => index + 1).map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="text-sm text-[var(--color-muted)]">
                  {item.price.toLocaleString("fr-GN")} GNF / unité
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl bg-[var(--color-blush)] p-4 text-sm text-[var(--color-muted)]">
        <div className="flex items-center justify-between">
          <span>Total estimé</span>
          <span className="font-semibold text-[var(--color-accent)]">
            {total.toLocaleString("fr-GN")} GNF
          </span>
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
