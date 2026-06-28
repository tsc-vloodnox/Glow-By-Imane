// Destination : app/(shop)/components/ProductCard.tsx
import Link from "next/link";

import { ProductImage } from "./ProductImage";

type ProductCardProduct = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  images: string[];
  category: { name: string };
};

export function ProductCard({ product }: { product: ProductCardProduct }) {
  const stockLabel =
    product.stock <= 0 ? "Rupture" : product.stock <= 3 ? `Plus que ${product.stock}` : "En stock";
  const stockTone = product.stock <= 0 ? "text-red-500" : product.stock <= 3 ? "text-amber-600" : "text-[var(--color-muted)]";

  return (
    <Link
      href={`/produits/${product.id}`}
      className="product-card flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white"
      style={{ boxShadow: "0 4px 20px rgba(139,26,58,0.05)" }}
    >
      <div className="relative aspect-[4/5] overflow-hidden">
        <ProductImage imageName={product.images[0]} alt={product.name} className="h-full w-full" />
      </div>
      <div className="flex flex-col gap-1 p-3">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-gold)]">
          {product.category.name}
        </span>
        <h3 className="text-sm font-semibold leading-snug text-[var(--color-foreground)]">{product.name}</h3>
        <p className="text-[11px] leading-snug text-[var(--color-muted)] line-clamp-2">{product.description}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--color-accent)]">
            {product.price.toLocaleString("fr-GN")} GNF
          </span>
          <span className={`text-[10px] ${stockTone}`}>{stockLabel}</span>
        </div>
      </div>
    </Link>
  );
}
