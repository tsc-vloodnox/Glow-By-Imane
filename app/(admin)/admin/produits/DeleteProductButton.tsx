"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteProduct } from "../actions";

type DeleteProductButtonProps = {
  productId: string;
};

export function DeleteProductButton({ productId }: DeleteProductButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm("Supprimer ce produit ?");
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    await deleteProduct(productId);
    router.refresh();
  }

  return (
    <button type="button" onClick={handleDelete} disabled={isDeleting} className="text-sm text-red-600 disabled:opacity-60">
      {isDeleting ? "Suppression..." : "Supprimer"}
    </button>
  );
}
