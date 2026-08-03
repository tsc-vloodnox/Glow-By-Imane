"use client";

import { useMemo, useState } from "react";

import { useCart } from "../CartContext";
import { resolveUnitPrice } from "@/lib/pricing";

type SizeOption = { id: string; label: string; price: number; stock: number };
type PackPriceOption = { quantity: number; price: number; productSizeId: string | null };

type ProductAddToCartProps = {
  product: { id: string; name: string; price: number };
  stock: number;
  sizes?: SizeOption[];
  packPrices?: PackPriceOption[];
};

export function ProductAddToCart({ product, stock, sizes = [], packPrices = [] }: ProductAddToCartProps) {
  const { addItem } = useCart();
  const hasSizes = sizes.length > 0;
  const [selectedSizeId, setSelectedSizeId] = useState<string | null>(hasSizes ? sizes[0].id : null);
  const [quantity, setQuantity] = useState(1);
  const [isAdded, setIsAdded] = useState(false);

  const selectedSize = hasSizes ? sizes.find((s) => s.id === selectedSizeId) ?? sizes[0] : null;
  const activeStock = selectedSize ? selectedSize.stock : stock;
  const basePrice = selectedSize ? selectedSize.price : product.price;
  const isOutOfStock = activeStock <= 0;

  const applicablePackPrices = useMemo(
    () =>
      packPrices
        .filter((p) => p.productSizeId === (selectedSize ? selectedSize.id : null))
        .map((p) => ({ quantity: p.quantity, price: p.price })),
    [packPrices, selectedSize],
  );

  const unitPrice = resolveUnitPrice(basePrice, applicablePackPrices, quantity);

  const decrease = () => setQuantity((q) => Math.max(1, q - 1));
  const increase = () => setQuantity((q) => Math.min(activeStock, q + 1));

  const handleSelectSize = (sizeId: string) => {
    setSelectedSizeId(sizeId);
    setQuantity(1);
  };

  const handleAdd = () => {
    if (isOutOfStock) return;
    addItem(
      {
        kind: "product",
        productId: product.id,
        productSizeId: selectedSize ? selectedSize.id : null,
        sizeLabel: selectedSize ? selectedSize.label : null,
        name: selectedSize ? `${product.name} — ${selectedSize.label}` : product.name,
        basePrice,
        packPrices: applicablePackPrices,
        stock: activeStock,
      },
      quantity,
    );
    setIsAdded(true);
    setTimeout(() => setIsAdded(false), 2000);
  };

  return (
    <div className="space-y-3">
      {hasSizes ? (
        <div className="flex flex-wrap gap-2">
          {sizes.map((size) => (
            <button
              key={size.id}
              type="button"
              onClick={() => handleSelectSize(size.id)}
              disabled={size.stock <= 0}
              className={`rounded-full border px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-40 ${
                selectedSizeId === size.id
                  ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                  : "border-[var(--color-border)] bg-white text-[var(--color-foreground)]"
              }`}
            >
              {size.label}
            </button>
          ))}
        </div>
      ) : null}

      <p className="text-sm font-semibold text-[var(--color-accent)]">
        {(unitPrice * quantity).toLocaleString("fr-GN")} GNF
        {quantity > 1 ? (
          <span className="ml-1 text-xs font-normal text-[var(--color-muted)]">
            ({unitPrice.toLocaleString("fr-GN")} GNF / unité)
          </span>
        ) : null}
      </p>

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
            disabled={quantity >= activeStock}
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