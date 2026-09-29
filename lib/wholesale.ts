// Destination : lib/wholesale.ts
// Commandes en gros (revendeurs) : règles et validation serveur des demandes.
//
// Principe : une demande revendeur n'engage pas le stock. Les prix affichés sont
// indicatifs (paliers et promos actuels), le prix final se négocie sur WhatsApp.
// Le stock n'est réservé qu'à la confirmation de l'accord, et peut alors devenir
// négatif (= quantité à réapprovisionner).

import { UserError } from "@/lib/action-result";
import { id, optionalString, phone, requiredString } from "@/lib/order-validation";

/** Nombre minimum d'unités (toutes lignes confondues) pour une demande en gros. */
export const WHOLESALE_MIN_TOTAL_QUANTITY = 10;
/** Quantité maximale par ligne (garde-fou contre les saisies aberrantes). */
export const WHOLESALE_MAX_LINE_QUANTITY = 10_000;
export const WHOLESALE_MAX_LINES = 60;

export type WholesaleItemInput = { productId: string; productSizeId: string | null; quantity: number };

export type WholesaleInput = {
  name: string;
  phone: string;
  quartier: string;
  businessName?: string;
  comment?: string;
  items: WholesaleItemInput[];
};

function quantity(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > WHOLESALE_MAX_LINE_QUANTITY) {
    throw new UserError(`Quantité invalide (entre 1 et ${WHOLESALE_MAX_LINE_QUANTITY.toLocaleString("fr-FR")} par article).`);
  }
  return value;
}

/** Valide une demande revendeur et fusionne les lignes identiques (même produit et taille). */
export function parseWholesaleInput(raw: unknown): WholesaleInput {
  if (typeof raw !== "object" || raw === null) throw new UserError("Demande invalide.");
  const data = raw as Record<string, unknown>;

  if (!Array.isArray(data.items) || data.items.length === 0) throw new UserError("Ajoutez au moins un article.");
  if (data.items.length > WHOLESALE_MAX_LINES) throw new UserError(`Trop d'articles (${WHOLESALE_MAX_LINES} lignes maximum).`);

  const merged = new Map<string, WholesaleItemInput>();
  for (const rawItem of data.items) {
    if (typeof rawItem !== "object" || rawItem === null) throw new UserError("Article invalide.");
    const item = rawItem as Record<string, unknown>;
    const productId = id(item.productId);
    const productSizeId = item.productSizeId == null ? null : id(item.productSizeId);
    const key = `${productId}:${productSizeId ?? ""}`;
    const existing = merged.get(key);
    const qty = quantity(item.quantity);
    merged.set(key, { productId, productSizeId, quantity: quantity((existing?.quantity ?? 0) + qty) });
  }
  const items = [...merged.values()];

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  if (totalQuantity < WHOLESALE_MIN_TOTAL_QUANTITY) {
    throw new UserError(
      `Une commande en gros compte au moins ${WHOLESALE_MIN_TOTAL_QUANTITY} unités (actuellement ${totalQuantity}).`,
    );
  }

  return {
    name: requiredString(data.name, "Nom", 80),
    phone: phone(data.phone, "Téléphone"),
    quartier: requiredString(data.quartier, "Ville / quartier", 120),
    businessName: optionalString(data.businessName, "Nom de la boutique", 120),
    comment: optionalString(data.comment, "Commentaire", 1000),
    items,
  };
}
