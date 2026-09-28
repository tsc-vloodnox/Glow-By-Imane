// Destination : app/(shop)/commande/gift-upload.ts
"use server";

import { uploadImageToCatalogue } from "@/lib/image-upload";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const GIFT_UPLOAD_LIMIT_PER_IP = 10;
const GIFT_UPLOAD_WINDOW_MS = 15 * 60 * 1000;

/**
 * Upload de la photo jointe à une carte cadeau (client, au checkout).
 * Endpoint public : images uniquement (vérifiées par magic bytes), rangées dans
 * "gifts/" pour les isoler du catalogue, et limitées en fréquence par IP.
 */
export async function uploadGiftPhoto(file: File) {
  if (!checkRateLimit(`gift-upload:${await getClientIp()}`, GIFT_UPLOAD_LIMIT_PER_IP, GIFT_UPLOAD_WINDOW_MS)) {
    throw new Error("Trop d'envois de photos. Merci de patienter quelques minutes.");
  }

  return uploadImageToCatalogue(file, { prefix: "gifts" });
}
