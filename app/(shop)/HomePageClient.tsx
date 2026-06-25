// Destination : app/(shop)/HomePageClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ProductImage } from "./components/ProductImage";

type ProductWithCategory = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  images: string[];
  category: {
    id: string;
    name: string;
  };
};

type CategoryItem = {
  id: string;
  label: string;
};

type HomePageClientProps = {
  products: ProductWithCategory[];
  categories: CategoryItem[];
  totalCount?: number;
};

export default function HomePageClient({ products, categories, totalCount }: HomePageClientProps) {
  const [activeCategory, setActiveCategory] = useState("all");

  // Remplace l'ancienne animation par manipulation DOM directe (querySelectorAll + setAttribute
  // dans un setTimeout) par un état React simple. Plus robuste : pas de désynchronisation
  // possible entre le DOM et le rendu React, et ça se redéclenche proprement au changement de filtre.
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRevealed(false);
    const frame = requestAnimationFrame(() => setRevealed(true));
    return () => cancelAnimationFrame(frame);
  }, [activeCategory]);

  const visibleProducts = useMemo(
    () =>
      products.filter((product) =>
        activeCategory === "all" ? true : product.category.id === activeCategory,
      ),
    [activeCategory, products],
  );

  return (
    <main className="pb-36 text-[var(--color-foreground)]">
      <section className="px-4 mt-4">
        <div className="relative h-[220px] rounded-3xl overflow-hidden bg-[var(--color-sand)] flex items-end">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(255,255,255,0.12)_0%,transparent_60%)]" />
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(135deg, #8B1A3A 0%, #C4637B 40%, #EDE3DC 100%)",
            }}
          />
          <div className="absolute top-6 right-8 w-24 h-24 rounded-full border border-white/20" />
          <div className="absolute top-12 right-14 w-12 h-12 rounded-full border border-white/15" />

          <div className="relative z-10 p-6 flex flex-col gap-2">
            <span className="text-white/70 text-[10px] tracking-[0.25em] uppercase font-sans">
              Nouvelle saison
            </span>
            <h1 className="font-serif text-white text-3xl italic leading-tight">
              Votre éclat,
              <br />révélé.
            </h1>
            <Link
              href="#product-grid"
              className="mt-2 w-max rounded-full bg-white px-5 py-2 text-xs font-semibold text-[var(--color-accent)] transition-transform active:scale-95"
            >
              Découvrir →
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-7">
        <div className="flex justify-between items-center px-4 mb-3">
          <h2 className="font-serif italic text-xl text-[var(--color-accent)]">Nos univers</h2>
          <Link href="/produits" className="text-[11px] text-[var(--color-muted)] underline underline-offset-2">
            Voir tous les produits
          </Link>
        </div>
        <div className="flex gap-3 px-4 overflow-x-auto pb-2 scroll-smooth">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.id)}
              className={`cat-pill flex-shrink-0 rounded-full px-4 py-2 text-[12px] font-medium transition-all border ${
                activeCategory === category.id
                  ? "border-transparent bg-[var(--color-accent)] text-white"
                  : "border-[rgba(107,31,42,0.2)] bg-[var(--color-blush)] text-[var(--color-accent)]"
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-7 px-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-2xl text-[var(--color-accent)]">Produits favoris</h2>
          <span className="text-[11px] text-[var(--color-muted)]">
            {visibleProducts.length} article{visibleProducts.length > 1 ? "s" : ""}
          </span>
        </div>

        {visibleProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted)]">
            Aucun produit favori dans cette catégorie pour le moment.
            <br />
            <Link href="/produits" className="mt-2 inline-block underline underline-offset-2 text-[var(--color-accent)]">
              Voir tout le catalogue
            </Link>
          </div>
        ) : (
          <div id="product-grid" className="grid grid-cols-2 gap-3">
            {visibleProducts.map((product, index) => (
              <Link
                key={product.id}
                href={`/produits/${product.id}`}
                className="product-card flex flex-col rounded-2xl border border-[var(--color-border)] bg-white overflow-hidden"
                style={{
                  boxShadow: "0 4px 20px rgba(139,26,58,0.05)",
                  opacity: revealed ? 1 : 0,
                  transform: revealed ? "translateY(0)" : "translateY(16px)",
                  transition: `opacity 0.5s cubic-bezier(0.16,1,0.3,1) ${index * 60}ms, transform 0.5s cubic-bezier(0.16,1,0.3,1) ${index * 60}ms`,
                }}
              >
                <div className="relative aspect-[4/5] overflow-hidden">
                  <ProductImage
                    imageName={product.images[0]}
                    alt={product.name}
                    className="h-full w-full"
                  />
                </div>
                <div className="p-3 flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-[var(--color-gold)]">
                    {product.category.name}
                  </span>
                  <h3 className="text-sm font-semibold text-[var(--color-foreground)] leading-snug">
                    {product.name}
                  </h3>
                  <p className="text-[11px] text-[var(--color-muted)] leading-snug">
                    {product.description}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--color-accent)]">
                      {product.price.toLocaleString("fr-GN")} GNF
                    </span>
                    <span className="text-[10px] text-[var(--color-muted)]">
                      {product.stock > 0 ? "En stock" : "Rupture"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {typeof totalCount === "number" && totalCount > products.length ? (
          <div className="px-4 mt-4 flex justify-center">
            <Link
              href="/produits"
              className="rounded-full border border-[var(--color-border)] px-5 py-2 text-sm font-semibold text-[var(--color-accent)]"
            >
              Voir tous les produits →
            </Link>
          </div>
        ) : null}
      </section>

      <section className="mt-8 px-4 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-[var(--color-blush)] p-3">
          <span className="text-[14px] font-semibold text-[var(--color-accent)]">Livraison Conakry</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-[var(--color-blush)] p-3">
          <span className="text-[14px] font-semibold text-[var(--color-accent)]">Produits Vérifiés</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-[var(--color-blush)] p-3">
          <span className="text-[14px] font-semibold text-[var(--color-accent)]">Conseils Personnalisés</span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-[var(--color-blush)] p-3">
          <span className="text-[14px] font-semibold text-[var(--color-accent)]">100% Satisfait</span>
        </div>
      </section>
    </main>
  );
}
