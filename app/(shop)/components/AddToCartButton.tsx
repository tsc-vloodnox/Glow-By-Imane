// Destination : app/(shop)/components/AddToCartButton.tsx
"use client";

import { useEffect, useRef, useState } from "react";

import { useCart } from "../CartContext";

type AddToCartButtonProps = {
  product: {
    id: string;
    name: string;
    price: number;
  };
  label?: string;
  redirectToCheckout?: boolean;
  className?: string;
  disabled?: boolean;
  maxQuantity?: number;
};

export function AddToCartButton({
  product,
  label = "Ajouter au panier",
  redirectToCheckout = false,
  className,
  disabled = false,
  maxQuantity,
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [isAdded, setIsAdded] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleClick = () => {
    if (disabled) return;

    addItem(product, 1, maxQuantity);
    setIsAdded(true);

    if (redirectToCheckout) {
      window.location.href = "/commande";
      return;
    }

    // Réinitialise le feedback après 2s pour permettre un nouvel ajout visible
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => setIsAdded(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`${className ?? ""} ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      {disabled ? "Indisponible" : isAdded ? "Ajouté ✓" : label}
    </button>
  );
}
