// Destination : app/(shop)/components/ShopPageClient.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

import { ProductCard } from "./ProductCard";
import { ShopSearchFilterBar } from "./ShopSearchFilterBar";

type ProductWithCategory = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  images: string[];
  category: { id: string; name: string };
};

type CategoryItem = { id: string; label: string };

type ShopPageClientProps = {
  products: ProductWithCategory[];
  categories: CategoryItem[];
};

const HERO_FADE_DISTANCE = 280; // px de scroll pour que le hero disparaisse complètement

export function ShopPageClient({ products, categories }: ShopPageClientProps) {
  const [activeCategory, setActiveCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [heroOpacity, setHeroOpacity] = useState(1);

  // Le hero s'estompe en douceur au scroll, sans bibliothèque externe :
  // juste la position de scroll mappée sur l'opacité.
  useEffect(() => {
    let frame = 0;
    const handleScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const ratio = 1 - Math.min(window.scrollY / HERO_FADE_DISTANCE, 1);
        setHeroOpacity(ratio);
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory =
        activeCategory === "all" || product.category.id === activeCategory;
      const matchesSearch =
        query.length === 0 ||
        product.name.toLowerCase().includes(query) ||
        product.description.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, products, search]);

  // Regroupement par catégorie uniquement quand aucun filtre de catégorie n'est actif —
  // sinon on affiche directement la grille filtrée sans séparateurs redondants.
  const groupedByCategory = useMemo(() => {
    if (activeCategory !== "all") {
      return null;
    }
    return categories
      .map((category) => ({
        category,
        items: filteredProducts.filter(
          (product) => product.category.id === category.id,
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [activeCategory, categories, filteredProducts]);

  return (
    <main className="pb-36 text-[var(--color-foreground)]">
      <section
        className="px-4 pb-4 mt-4 transition-opacity"
        style={{
          opacity: heroOpacity,
          pointerEvents: heroOpacity < 0.1 ? "none" : "auto",
        }}
      >
        <div className="relative h-[220px] rounded-3xl overflow-hidden bg-[var(--color-sand)] flex items-end">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(255,255,255,0.12)_0%,transparent_60%)]" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, #8B1A3A 0%, #C4637B 40%, #EDE3DC 100%)",
            }}
          />
          {/* Image décorative à gauche — blanc/doré, fondue dans le dégradé via un masque
              qui estompe son bord droit (et un peu le bas) pour qu'elle se fonde
              naturellement plutôt que de "flotter" au-dessus du fond. */}
          <img
            src="/hero-illustration.png"
            alt=""
            aria-hidden="true"
            className="absolute right-0 bottom-0 top-0 h-full w-full object-contain object-right opacity-90 max-md:hidden"

          />

          <span className="absolute top-5 left-5 z-10 font-serif italic text-lg tracking-wide text-[var(--color-gold)] drop-shadow-sm">
            Glow By Imane
          </span>

          <div className="relative z-10 p-6 flex flex-col gap-2">
            <span className="text-white/70 text-[10px] tracking-[0.25em] uppercase font-sans">
              Nouvelle saison
            </span>
            <h1 className="font-serif text-white text-3xl italic leading-tight">
              Votre éclat,
              <br />
              révélé.
            </h1>
          </div>
        </div>
      </section>

      <ShopSearchFilterBar
        categories={categories}
        activeCategory={activeCategory}
        onCategoryChange={setActiveCategory}
        searchValue={search}
        onSearchChange={setSearch}
      />

      <section className="mt-5 px-4">
        {filteredProducts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted)]">
            Aucun produit ne correspond à votre recherche.
          </div>
        ) : groupedByCategory ? (
          <div className="space-y-8">
            {groupedByCategory.map((group) => (
              <div key={group.category.id}>
                <div className="mb-3 flex items-baseline justify-between border-b border-[var(--color-border)] pb-2">
                  <h2 className="font-serif text-xl text-[var(--color-accent)]">
                    {group.category.label}
                  </h2>
                  <span className="text-[11px] text-[var(--color-muted)]">
                    {group.items.length} article(s)
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {group.items.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 px-4 grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-[var(--color-blush)] p-3">
          <span className="text-[14px] font-semibold text-[var(--color-accent)]">
            Livraison Conakry
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-[var(--color-blush)] p-3">
          <span className="text-[14px] font-semibold text-[var(--color-accent)]">
            Produits Vérifiés
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-[var(--color-blush)] p-3">
          <span className="text-[14px] font-semibold text-[var(--color-accent)]">
            Conseils Personnalisés
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-[var(--color-blush)] p-3">
          <span className="text-[14px] font-semibold text-[var(--color-accent)]">
            100% Satisfait
          </span>
        </div>
      </section>
    </main>
  );
}
