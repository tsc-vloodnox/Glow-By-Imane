// Destination : app/(shop)/components/ProductAddToCart.tsx
"use client";

import { useState } from "react";

import { addToCart } from "@/lib/cart";

type ProductAddToCartProps = {
  product: { id: string; name: string; price: number };
  stock: number;
};

export function ProductAddToCart({ product, stock }: ProductAddToCartProps) {
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);
  const isOutOfStock = stock <= 0;

  const decrease = () => setQuantity((q) => Math.max(1, q - 1));
  const increase = () => setQuantity((q) => Math.min(stock, q + 1));

  const handleAdd = () => {
    if (isOutOfStock) return;
    addToCart(product, quantity, stock);
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  return (
    <div className="space-y-3">
      {!isOutOfStock ? (
        <div className="flex items-center justify-center gap-4 rounded-2xl border border-[var(--color-border)] bg-white py-2">
          <button
            type="button"
            onClick={decrease}
            disabled={quantity <= 1}
            aria-label="Diminuer la quantité"
            className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-[var(--color-accent)] disabled:opacity-30"
          >
            −
          </button>
          <span className="w-8 text-center text-sm font-semibold">{quantity}</span>
          <button
            type="button"
            onClick={increase}
            disabled={quantity >= stock}
            aria-label="Augmenter la quantité"
            className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-[var(--color-accent)] disabled:opacity-30"
          >
            +
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={handleAdd}
        disabled={isOutOfStock}
        className={`flex min-h-[56px] w-full items-center justify-center rounded-2xl px-6 py-3 text-center text-sm font-medium text-white shadow-[0_10px_28px_rgba(107,31,42,0.2)] transition hover:opacity-95 ${
          isOutOfStock ? "cursor-not-allowed bg-gray-300" : "bg-[var(--color-accent)]"
        }`}
      >
        {isOutOfStock ? "Indisponible" : isAdded ? "Ajouté ✓" : "Ajouter au panier"}
      </button>
    </div>
  );
}
