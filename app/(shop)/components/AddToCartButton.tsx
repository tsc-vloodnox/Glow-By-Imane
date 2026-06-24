"use client";

import { useState } from "react";

import { addToCart } from "@/lib/cart";

type AddToCartButtonProps = {
  product: {
    id: string;
    name: string;
    price: number;
  };
  label?: string;
  redirectToCheckout?: boolean;
  className?: string;
};

export function AddToCartButton({
  product,
  label = "Ajouter au panier",
  redirectToCheckout = false,
  className,
}: AddToCartButtonProps) {
  const [isAdded, setIsAdded] = useState(false);

  const handleClick = () => {
    addToCart(product);
    setIsAdded(true);

    if (redirectToCheckout) {
      window.location.href = "/commande";
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={className}
    >
      {isAdded ? "Ajouté au panier" : label}
    </button>
  );
}
