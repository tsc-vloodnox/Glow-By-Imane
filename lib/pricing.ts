// Destination : lib/pricing.ts

export type PackPriceRule = { quantity: number; price: number };
export type ActivePromotion = { discountPercent: number };

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
 * Prix de référence d'un article : `originalPrice` s'il existe et dépasse `price`
 * (remise permanente), sinon `price`. C'est le prix affiché barré.
 */
export function getReferencePrice(price: number, originalPrice: number | null | undefined): number {
  return originalPrice && originalPrice > price ? originalPrice : price;
}

/**
 * Prix unitaire réellement facturé, promotion active comprise.
 *
 * Règle métier : les remises NE SE CUMULENT PAS — on applique la plus
 * avantageuse pour le client entre :
 * - la remise permanente (`basePrice`, déjà net, face à `originalPrice`)
 * - la meilleure promotion temporaire, appliquée au prix de référence
 *   (`originalPrice` s'il existe, sinon `basePrice`)
 *
 * Utilisée à la fois pour l'affichage (PriceDisplay), le panier et la commande
 * serveur, afin que le prix affiché soit toujours le prix facturé.
 */
export function resolveActiveUnitPrice(
  basePrice: number,
  activePromotions: ActivePromotion[] = [],
  originalPrice?: number | null,
): number {
  if (activePromotions.length === 0) return basePrice;
  const promoPercent = Math.max(...activePromotions.map((p) => p.discountPercent));
  if (promoPercent <= 0) return basePrice;
  const promoPrice = Math.round(getReferencePrice(basePrice, originalPrice) * (1 - promoPercent / 100));
  return Math.min(basePrice, promoPrice);
}

/**
 * Remise effective à afficher sur un produit (remise permanente ou promotion,
 * la plus avantageuse — jamais les deux cumulées).
 * Retourne null si aucune remise n'est applicable.
 */
export function getEffectiveDiscount(
  price: number,
  originalPrice: number | null | undefined,
  activePromotions: ActivePromotion[] = [],
): { discountedPrice: number; referencePrice: number; discountPercent: number } | null {
  const referencePrice = getReferencePrice(price, originalPrice);
  const discountedPrice = resolveActiveUnitPrice(price, activePromotions, originalPrice);
  if (discountedPrice >= referencePrice) return null;

  return {
    discountedPrice,
    referencePrice,
    discountPercent: Math.round((1 - discountedPrice / referencePrice) * 100),
  };
}

/**
 * Comme resolveLineTotal, mais applique d'abord la promotion active
 * (si présente) sur le prix unitaire avant de résoudre les paliers de quantité.
 */
export function resolveDiscountedLineTotal(
  basePrice: number,
  activePromotions: ActivePromotion[],
  packPrices: PackPriceRule[],
  quantity: number,
  originalPrice?: number | null,
): number {
  const unitPrice = resolveActiveUnitPrice(basePrice, activePromotions, originalPrice);
  return resolveLineTotal(unitPrice, packPrices, quantity);
}

/** Prix unitaire moyen affiché, promotion active comprise. */
export function resolveDiscountedUnitPrice(
  basePrice: number,
  activePromotions: ActivePromotion[],
  packPrices: PackPriceRule[],
  quantity: number,
  originalPrice?: number | null,
): number {
  if (quantity <= 0) return resolveActiveUnitPrice(basePrice, activePromotions, originalPrice);
  return Math.round(
    resolveDiscountedLineTotal(basePrice, activePromotions, packPrices, quantity, originalPrice) / quantity,
  );
}