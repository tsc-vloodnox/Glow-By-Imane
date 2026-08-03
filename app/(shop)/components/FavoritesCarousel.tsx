// Destination : app/(shop)/components/FavoritesCarousel.tsx
import Link from "next/link";

import { ProductImage } from "./ProductImage";

type FavoriteProduct = {
  id: string;
  name: string;
  price: number;
  stock: number;
  images: string[];
};

export function FavoritesCarousel({ products }: { products: FavoriteProduct[] }) {
  if (products.length === 0) return null;

  return (
    <section className="mt-2">
      <div className="px-4 mb-2 flex items-baseline justify-between">
        <h2 className="font-serif text-lg text-[var(--color-accent)]">Nos coups de cœur</h2>
      </div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-1 snap-x snap-mandatory [scroll-snap-stop:always]">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/produits/${product.id}`}
            className="flex-none w-32 snap-start overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white"
            style={{ boxShadow: "0 4px 20px rgba(139,26,58,0.05)" }}
          >
            <div className="relative aspect-[4/5]">
              <ProductImage
                imageName={product.images[0]}
                alt={product.name}
                className="h-full w-full"
                dim={product.stock <= 0}
              />
            </div>
            <div className="p-2">
              <p className="text-[11px] font-medium leading-snug line-clamp-1 text-[var(--color-foreground)]">
                {product.name}
              </p>
              <p className="text-[11px] font-semibold text-[var(--color-accent)]">
                {product.price.toLocaleString("fr-GN")} GNF
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
