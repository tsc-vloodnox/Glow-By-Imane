// Destination : app/(shop)/components/ProductCard.tsx
import Link from "next/link";

import { ProductImage } from "./ProductImage";
import type { ProductWithPricing } from "@/types/types";

// createdAt volontairement omis : ce composant ne l'utilise pas, et l'exiger
// forçait un conflit de type entre la version serveur (Date) et la version
// reçue côté client (potentiellement sérialisée en string) selon les endroits
// où ProductCard est appelé.
type ProductCardData = Omit<ProductWithPricing, "createdAt">;

export function ProductCard({ product }: { product: ProductCardData }) {
  const activeSizes = product.sizes.filter((s) => !s.archived);
  const hasSizes = activeSizes.length > 0;

  const displayPrice = hasSizes
    ? Math.min(...activeSizes.map((s) => s.price))
    : product.price;

  const totalStock = hasSizes
    ? activeSizes.reduce((sum, s) => sum + s.stock, 0)
    : product.stock;

  const hasPackPrice = product.packPrices.some((p) => p.productSizeId === null);

  const stockLabel =
    totalStock <= 0 ? "Rupture" : totalStock <= 3 ? `Plus que ${totalStock}` : "En stock";
  const stockTone =
    totalStock <= 0
      ? "text-red-500"
      : totalStock <= 3
        ? "text-amber-600"
        : "text-[var(--color-muted)]";

  return (
    <Link
      href={`/produits/${product.id}`}
      className="product-card flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white"
      style={{ boxShadow: "0 4px 20px rgba(139,26,58,0.05)" }}
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <ProductImage imageName={product.images[0]} alt={product.name} className="h-full w-full" />
        {hasPackPrice ? (
          <span className="absolute left-2 top-2 rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[9px] font-medium text-white">
            Prix par lot
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1 p-3">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-gold)]">
          {product.category.name}
        </span>
        <h3 className="text-sm font-semibold leading-snug text-[var(--color-foreground)]">
          {product.name}
        </h3>
        <p className="text-[11px] leading-snug text-[var(--color-muted)] line-clamp-2">
          {product.description}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--color-accent)]">
            {hasSizes ? "Dès " : ""}
            {displayPrice.toLocaleString("fr-GN")} GNF
          </span>
          <span className={`text-[10px] ${stockTone}`}>{stockLabel}</span>
        </div>
      </div>
    </Link>
  );
}