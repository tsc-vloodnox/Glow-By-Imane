// Destination : app/(shop)/commande/gift-upload.ts
"use server";

import { randomUUID } from "crypto";

import { createServiceClient } from "@/lib/supabase/server";

const BUCKET = "catalogue";
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// Détecte le vrai type MIME depuis les magic bytes du fichier
// (plus fiable que file.type qui peut être vide sur mobile)
function detectMime(buffer: Buffer): string {
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return "image/jpeg";
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  )
    return "image/png";
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[4] === 0x57)
    return "image/webp";
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46)
    return "image/gif";
  return "image/jpeg"; // fallback raisonnable
}

function mimeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[mime] ?? "jpg";
}

/** Upload de la photo jointe à une carte cadeau (client, au checkout). */
export async function uploadGiftPhoto(file: File) {
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error(
      `Image trop lourde (${(file.size / 1024 / 1024).toFixed(1)} Mo). Maximum : ${MAX_SIZE_MB} Mo.`,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const mime = detectMime(buffer);
  const ext = mimeToExt(mime);
  const fileName = `${randomUUID()}.${ext}`;

  const supabase = createServiceClient();

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, buffer, {
      contentType: mime,
      upsert: false,
    });

  if (error) {
    throw new Error(`Échec de l'upload : ${error.message}`);
  }

  return fileName;
}
