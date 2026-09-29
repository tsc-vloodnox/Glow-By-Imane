// Destination : lib/order-validation.ts
// Validation serveur des commandes passées depuis la boutique publique.
// Les server actions sont appelables par n'importe qui avec n'importe quel payload :
// on ne fait JAMAIS confiance aux types TypeScript côté serveur.

import type { CartItemInput, GiftInput, OrderInput } from "@/types/types";
import { UserError } from "@/lib/action-result";

/** Numéro guinéen : 6XXXXXXXX, avec ou sans indicatif 224 / +224 (espaces retirés avant test). */
export const GUINEA_PHONE_PATTERN = /^(\+?224)?6\d{8}$/;

/** Chemin d'une photo cadeau uploadée par uploadGiftPhoto. */
const GIFT_PHOTO_PATTERN = /^gifts\/[0-9a-f-]{36}\.(?:jpg|png|webp|gif)$/;

export const MAX_ORDER_LINES = 30;
export const MAX_LINE_QUANTITY = 50;

function fail(message: string): never {
  throw new UserError(message);
}

export function requiredString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") fail(`${label} invalide.`);
  const trimmed = value.trim();
  if (!trimmed) fail(`${label} requis.`);
  if (trimmed.length > maxLength) fail(`${label} trop long (${maxLength} caractères maximum).`);
  return trimmed;
}

export function optionalString(value: unknown, label: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") fail(`${label} invalide.`);
  const trimmed = value.trim();
  if (trimmed.length > maxLength) fail(`${label} trop long (${maxLength} caractères maximum).`);
  return trimmed || undefined;
}

export function phone(value: unknown, label: string): string {
  if (typeof value !== "string") fail(`${label} invalide.`);
  const compact = value.replace(/\s/g, "");
  if (!GUINEA_PHONE_PATTERN.test(compact)) fail(`${label} invalide (format attendu : 6XX XX XX XX).`);
  return compact;
}

export function id(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) fail("Article invalide.");
  return value;
}

function quantity(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > MAX_LINE_QUANTITY) {
    fail(`Quantité invalide (entre 1 et ${MAX_LINE_QUANTITY} par article).`);
  }
  return value;
}

function parseItem(raw: unknown): CartItemInput {
  if (typeof raw !== "object" || raw === null) fail("Article invalide.");
  const item = raw as Record<string, unknown>;

  if (item.kind === "kit") {
    return { kind: "kit", kitId: id(item.kitId), quantity: quantity(item.quantity) };
  }
  if (item.kind === "product") {
    return {
      kind: "product",
      productId: id(item.productId),
      productSizeId: item.productSizeId == null ? null : id(item.productSizeId),
      quantity: quantity(item.quantity),
    };
  }
  fail("Article invalide.");
}

function parseGift(raw: unknown): GiftInput | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object") fail("Informations cadeau invalides.");
  const gift = raw as Record<string, unknown>;

  const photo = optionalString(gift.photo, "Photo", 100);
  if (photo && !GIFT_PHOTO_PATTERN.test(photo)) fail("Photo de la carte cadeau invalide.");

  return {
    recipientName: requiredString(gift.recipientName, "Nom du destinataire", 80),
    recipientPhone: phone(gift.recipientPhone, "Téléphone du destinataire"),
    recipientAddress: requiredString(gift.recipientAddress, "Adresse du destinataire", 200),
    message: optionalString(gift.message, "Message", 1000),
    photo,
    printRequested: gift.printRequested === true,
  };
}

/** Valide et normalise une commande entrante. Lève une Error au message affichable sinon. */
export function parseOrderInput(raw: unknown): OrderInput {
  if (typeof raw !== "object" || raw === null) fail("Commande invalide.");
  const data = raw as Record<string, unknown>;

  if (!Array.isArray(data.items) || data.items.length === 0) fail("Le panier est vide.");
  if (data.items.length > MAX_ORDER_LINES) fail(`Trop d'articles (${MAX_ORDER_LINES} lignes maximum).`);

  return {
    name: requiredString(data.name, "Nom", 80),
    phone: phone(data.phone, "Téléphone"),
    quartier: requiredString(data.quartier, "Quartier", 120),
    comment: optionalString(data.comment, "Commentaire", 500),
    items: data.items.map(parseItem),
    gift: parseGift(data.gift),
  };
}
