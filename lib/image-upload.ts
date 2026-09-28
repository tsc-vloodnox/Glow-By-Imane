// Destination : lib/image-upload.ts
// Upload d'images vers Supabase Storage (bucket "catalogue") — serveur uniquement.
// Partagé par l'upload admin (produits, kits, cartes cadeau) et l'upload client (photo cadeau).

import { randomUUID } from "crypto";

import { createServiceClient } from "@/lib/supabase/server";
import { UserError } from "@/lib/action-result";

const BUCKET = "catalogue";
export const MAX_IMAGE_SIZE_MB = 5;
const MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * Détecte le vrai type MIME depuis les magic bytes du fichier
 * (plus fiable que file.type, qui peut être vide sur mobile ou falsifié).
 * Retourne null si ce n'est pas une image JPEG, PNG, WebP ou GIF.
 */
export function detectImageMime(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "image/png";
  if (buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buffer.toString("ascii", 0, 4) === "GIF8") return "image/gif";
  return null;
}

/**
 * Vérifie puis envoie une image dans le bucket. Retourne le chemin du fichier
 * dans le bucket (ex: "a1b2….webp" ou "gifts/a1b2….webp" avec un préfixe).
 */
export async function uploadImageToCatalogue(file: File, options: { prefix?: string } = {}): Promise<string> {
  if (!(file instanceof File) || file.size === 0) {
    throw new UserError("Aucune image reçue.");
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new UserError(
      `Image trop lourde (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum : ${MAX_IMAGE_SIZE_MB} Mo.`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = detectImageMime(buffer);
  if (!mime) {
    throw new UserError("Format d'image non supporté. Formats acceptés : JPEG, PNG, WebP, GIF.");
  }

  const fileName = `${options.prefix ? `${options.prefix}/` : ""}${randomUUID()}.${MIME_TO_EXT[mime]}`;

  const { error } = await createServiceClient()
    .storage.from(BUCKET)
    .upload(fileName, buffer, { contentType: mime, upsert: false });

  if (error) {
    throw new UserError(`Échec de l'upload : ${error.message}`);
  }

  return fileName;
}

/** Supprime une image du bucket. */
export async function removeImageFromCatalogue(fileName: string) {
  await createServiceClient().storage.from(BUCKET).remove([fileName]);
}
