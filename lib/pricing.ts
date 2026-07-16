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
 * Résout la remise effective à afficher sur un produit en combinant :
 * - la remise permanente (originalPrice sur le produit)
 * - les promotions temporaires actives (table Promotion)
 *
 * CORRECTIF : les deux pourcentages sont désormais calculés — et réappliqués —
 * par rapport au même prix de référence (`originalPrice` s'il existe, sinon
 * `price`). Avant, le pourcentage permanent était réappliqué sur `price`
 * (déjà net de remise), ce qui provoquait une double remise. Avec ce calcul,
 * quand la remise permanente l'emporte, le prix affiché retombe bien sur
 * `price` (pas de double remise) ; quand une promo plus avantageuse existe,
 * elle s'applique proprement au prix de référence.
 *
 * On applique toujours la plus avantageuse pour le client.
 * Retourne null si aucune remise n'est applicable.
 */
export function getEffectiveDiscount(
  price: number,
  originalPrice: number | null | undefined,
  activePromotions: ActivePromotion[] = [],
): { discountedPrice: number; discountPercent: number } | null {
  const hasPermanent = !!originalPrice && originalPrice > price;
  const referencePrice = hasPermanent ? (originalPrice as number) : price;

  const permanentPercent = hasPermanent
    ? Math.round((1 - price / (originalPrice as number)) * 100)
    : 0;

  const promoPercent =
    activePromotions.length > 0
      ? Math.max(...activePromotions.map((p) => p.discountPercent))
      : 0;

  const best = Math.max(permanentPercent, promoPercent);
  if (best <= 0) return null;

  return {
    discountPercent: best,
    discountedPrice: Math.round(referencePrice * (1 - best / 100)),
  };
}

/**
 * Prix unitaire réellement facturé côté panier/commande : `basePrice` (ex.
 * product.price / kit.price) est déjà net de remise permanente — seule une
 * promotion active vient réduire davantage ce prix ici.
 */
export function resolveActiveUnitPrice(
  basePrice: number,
  activePromotions: ActivePromotion[] = [],
): number {
  if (activePromotions.length === 0) return basePrice;
  const promoPercent = Math.max(...activePromotions.map((p) => p.discountPercent));
  if (promoPercent <= 0) return basePrice;
  return Math.round(basePrice * (1 - promoPercent / 100));
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
): number {
  const unitPrice = resolveActiveUnitPrice(basePrice, activePromotions);
  return resolveLineTotal(unitPrice, packPrices, quantity);
}

/** Prix unitaire moyen affiché, promotion active comprise. */
export function resolveDiscountedUnitPrice(
  basePrice: number,
  activePromotions: ActivePromotion[],
  packPrices: PackPriceRule[],
  quantity: number,
): number {
  if (quantity <= 0) return resolveActiveUnitPrice(basePrice, activePromotions);
  return Math.round(resolveDiscountedLineTotal(basePrice, activePromotions, packPrices, quantity) / quantity);
}