// Destination : app/(shop)/components/PriceDisplay.tsx

import { getEffectiveDiscount } from "@/lib/pricing";

type ActivePromotion = { discountPercent: number };

type PriceDisplayProps = {
  price: number;
  originalPrice?: number | null;
  activePromotions?: ActivePromotion[];
  size?: "sm" | "lg";
};

export function PriceDisplay({
  price,
  originalPrice,
  activePromotions = [],
  size = "sm",
}: PriceDisplayProps) {
  const effective = getEffectiveDiscount(price, originalPrice, activePromotions);

  const displayPrice = effective ? effective.discountedPrice : price;
  // Prix de référence affiché barré (originalPrice si remise permanente, sinon price)
  const referencePrice = effective ? effective.referencePrice : price;

  const priceClass =
    size === "lg"
      ? "font-serif text-3xl text-[var(--color-accent)]"
      : "text-sm font-semibold text-[var(--color-accent)]";

  const originalClass =
    size === "lg"
      ? "text-base text-[var(--color-muted)] line-through"
      : "text-xs text-[var(--color-muted)] line-through";

  if (!effective) {
    return (
      <span className={priceClass}>
        {price.toLocaleString("fr-GN")} GNF
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-baseline gap-1.5">
      <span className={priceClass}>
        {displayPrice.toLocaleString("fr-GN")} GNF
      </span>
      <span className={originalClass}>
        {referencePrice.toLocaleString("fr-GN")} GNF
      </span>
      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
        -{effective.discountPercent}%
      </span>
    </div>
  );
}
