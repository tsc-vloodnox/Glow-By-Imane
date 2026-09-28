"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteProduct as deleteProductAction } from "../actions";
import { unwrapAction } from "@/lib/action-result";

// Actions serveur : lèvent une Error au message lisible en cas d'échec (cf. lib/action-result.ts)
const deleteProduct = unwrapAction(deleteProductAction);

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
    try {
      await deleteProduct(productId);
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Erreur lors de la suppression.");
      setIsDeleting(false);
    }
  }

  return (
    <button type="button" onClick={handleDelete} disabled={isDeleting} className="text-sm text-red-600 disabled:opacity-60">
      {isDeleting ? "Suppression..." : "Supprimer"}
    </button>
  );
}
