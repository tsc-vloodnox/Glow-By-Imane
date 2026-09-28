// Destination : app/admin/produits/upload.ts
"use server";

import { removeImageFromCatalogue, uploadImageToCatalogue } from "@/lib/image-upload";
import { requireAdmin } from "../actions";

// Nom de fichier tel que généré par uploadImageToCatalogue (uuid.ext, éventuellement préfixé)
const IMAGE_PATH_PATTERN = /^(?:[a-z]+\/)?[0-9a-f-]{36}\.(?:jpg|png|webp|gif)$/;

export async function uploadProductImage(file: File) {
  await requireAdmin();
  return uploadImageToCatalogue(file);
}

/**
 * Supprime une image du bucket.
 * À appeler quand un produit est supprimé ou qu'une image est retirée.
 */
export async function deleteProductImage(fileName: string) {
  await requireAdmin();
  if (!IMAGE_PATH_PATTERN.test(fileName)) {
    throw new Error("Nom de fichier invalide.");
  }
  await removeImageFromCatalogue(fileName);
}
