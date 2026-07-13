// Destination : lib/pricing.ts

export type PackPriceRule = { quantity: number; price: number };

/**
 * Prix total pour une quantité donnée, paliers appliqués de façon gloutonne
 * (du plus gros au plus petit), puis prix de base pour le reste.
 */
export function resolveLineTotal(
  basePrice: number,
  packPrices: PackPriceRule[],
  quantity: number,
): number {
  if (quantity <= 0) return 0;

  const tiers = [...packPrices]
    .filter((t) => t.quantity > 0)
    .sort((a, b) => b.quantity - a.quantity);
  let remaining = quantity;
  let total = 0;

  for (const tier of tiers) {
    const groups = Math.floor(remaining / tier.quantity);
    if (groups > 0) {
      total += groups * tier.price;
      remaining -= groups * tier.quantity;
    }
  }

  return total + remaining * basePrice;
}

/** Prix unitaire moyen affiché à l'utilisateur (total / quantité). */
export function resolveUnitPrice(
  basePrice: number,
  packPrices: PackPriceRule[],
  quantity: number,
): number {
  if (quantity <= 0) return basePrice;
  return Math.round(resolveLineTotal(basePrice, packPrices, quantity) / quantity);
}

/**
 * Calcule le pourcentage de remise entre un prix original et un prix actuel.
 * Retourne null si pas de remise (originalPrice absent ou inférieur au price).
 */
export function getDiscountPercent(
  price: number,
  originalPrice: number | null | undefined,
): number | null {
  if (!originalPrice || originalPrice <= price) return null;
  return Math.round((1 - price / originalPrice) * 100);
}

/** Retourne true si le produit/kit a une remise permanente active. */
export function hasDiscount(
  price: number,
  originalPrice: number | null | undefined,
): boolean {
  return getDiscountPercent(price, originalPrice) !== null;
}

/**
 * Résout la remise effective à afficher sur un produit en combinant :
 * - la remise permanente (originalPrice sur le produit)
 * - les promotions temporaires actives (table Promotion)
 *
 * On applique toujours la plus avantageuse pour le client.
 * Retourne null si aucune remise n'est applicable.
 */
export function getEffectiveDiscount(
  price: number,
  originalPrice: number | null | undefined,
  activePromotions: { discountPercent: number }[] = [],
): { discountedPrice: number; discountPercent: number } | null {
  const permanentPercent =
    originalPrice && originalPrice > price
      ? Math.round((1 - price / originalPrice) * 100)
      : 0;

  const promoPercent =
    activePromotions.length > 0
      ? Math.max(...activePromotions.map((p) => p.discountPercent))
      : 0;

  const best = Math.max(permanentPercent, promoPercent);
  if (best <= 0) return null;

  return {
    discountPercent: best,
    discountedPrice: Math.round(price * (1 - best / 100)),
  };
}
