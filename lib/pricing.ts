export type PackPriceRule = { quantity: number; price: number };

/**
 * Prix total pour une quantité donnée, paliers appliqués de façon gloutonne
 * (du plus gros au plus petit), puis prix de base pour le reste.
 * Ex : palier "3 pour 100 000" + achat de 7 → 2×100 000 (6 articles) + 1×prix de base.
 */
export function resolveLineTotal(basePrice: number, packPrices: PackPriceRule[], quantity: number): number {
  if (quantity <= 0) return 0;

  const tiers = [...packPrices].filter((t) => t.quantity > 0).sort((a, b) => b.quantity - a.quantity);
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
export function resolveUnitPrice(basePrice: number, packPrices: PackPriceRule[], quantity: number): number {
  if (quantity <= 0) return basePrice;
  return Math.round(resolveLineTotal(basePrice, packPrices, quantity) / quantity);
}