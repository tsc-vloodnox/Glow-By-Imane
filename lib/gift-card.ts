// Destination : lib/gift-card.ts

export const GIFT_LINK_EXPIRY_DAYS = 30;

/**
 * Message par défaut affiché sur la carte cadeau quand le client n'en a saisi
 * aucun (ou que l'admin n'a pas encore personnalisé). Calculé à l'affichage,
 * jamais persisté — permet de changer la formulation par défaut sans devoir
 * mettre à jour les cartes déjà créées.
 */
export function buildDefaultGiftMessage(
  clientName: string,
  items: { name: string; quantity: number }[],
): string {
  const articles = items.map((i) => (i.quantity > 1 ? `${i.quantity}x ${i.name}` : i.name)).join(", ");
  return `"${clientName}" vous offre ${articles}. Nous espérons que ce cadeau vous fera plaisir !`;
}

/** URL publique de consultation d'une carte cadeau publiée. */
export function giftCardUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://glowbyimane.com";
  return `${base.replace(/\/$/, "")}/cadeau/${token}`;
}
