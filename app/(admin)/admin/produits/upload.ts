// Destination : app/admin/produits/upload.ts
"use server";

import { removeImageFromCatalogue, uploadImageToCatalogue } from "@/lib/image-upload";
import { requireAdmin } from "../actions";
import { UserError, withActionResult } from "@/lib/action-result";

// Nom de fichier tel que généré par uploadImageToCatalogue (uuid.ext, éventuellement préfixé)
const IMAGE_PATH_PATTERN = /^(?:[a-z]+\/)?[0-9a-f-]{36}\.(?:jpg|png|webp|gif)$/;

async function uploadProductImageImpl(file: File) {
  await requireAdmin();
  return uploadImageToCatalogue(file);
}

/**
 * Supprime une image du bucket.
 * À appeler quand un produit est supprimé ou qu'une image est retirée.
 */
async function deleteProductImageImpl(fileName: string) {
  await requireAdmin();
  if (!IMAGE_PATH_PATTERN.test(fileName)) {
    throw new UserError("Nom de fichier invalide.");
  }
  await removeImageFromCatalogue(fileName);
}

// ─── Exports ──────────────────────────────────────────────────────────────────
// Enveloppées par withActionResult : renvoient { ok, data | error } au lieu de lever
// une erreur, dont le message serait masqué par Next.js en production.
// Côté client : const x = unwrapAction(xAction) — cf. lib/action-result.ts

export const uploadProductImage = withActionResult(uploadProductImageImpl);
export const deleteProductImage = withActionResult(deleteProductImageImpl);
