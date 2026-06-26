// Destination : app/(shop)/page.tsx
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ProductImage } from "./components/ProductImage";

const MAX_HOME_PRODUCTS = 10;

type SearchParams = Promise<{ cat?: string }>;

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const { cat } = await searchParams;

  // Uniquement les catégories qui ont au moins un produit favori
  const categoriesWithFavorites = await prisma.category.findMany({
    where: { products: { some: { favorite: true } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const activeCategory = cat && categoriesWithFavorites.some((c) => c.id === cat) ? cat : null;

  const [products, totalCount] = await Promise.all([
    prisma.product.findMany({
      where: {
        favorite: true,
        ...(activeCategory ? { categoryId: activeCategory } : {}),
      },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      take: MAX_HOME_PRODUCTS,
    }),
    prisma.product.count({
      where: {
        favorite: true,
        ...(activeCategory ? { categoryId: activeCategory } : {}),
      },
    }),
  ]);

  const categoryPills = [
    { id: null, label: "Tout" },
    ...categoriesWithFavorites.map((c) => ({ id: c.id, label: c.name })),
  ];

  return (
    <main className="pb-36 text-[var(--color-foreground)]">
      {/* Hero */}
      <section className="px-4 mt-4">
        <div className="relative h-[220px] rounded-3xl overflow-hidden flex items-end">
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(135deg, #8B1A3A 0%, #C4637B 40%, #EDE3DC 100%)",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_30%,rgba(255,255,255,0.12)_0%,transparent_60%)]" />
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
            <a
              href="#product-grid"
              className="mt-2 w-max rounded-full bg-white px-5 py-2 text-xs font-semibold text-[var(--color-accent)] transition-transform active:scale-95"
            >
              Découvrir →
            </a>
          </div>
        </div>
      </section>

      {/* Filtres catégories */}
      <section className="mt-7">
        <div className="flex justify-between items-center px-4 mb-3">
          <h2 className="font-serif italic text-xl text-[var(--color-accent)]">Nos univers</h2>
          <Link
            href="/produits"
            className="text-[11px] text-[var(--color-muted)] underline underline-offset-2"
          >
            Voir tous les produits
          </Link>
        </div>

        <div className="flex gap-3 px-4 overflow-x-auto pb-2 scroll-smooth">
          {categoryPills.map((pill) => {
            const isActive = pill.id === activeCategory;
            const href = pill.id ? `/?cat=${pill.id}` : "/";
            return (
              <Link
                key={pill.id ?? "all"}
                href={href}
                className={`flex-shrink-0 rounded-full px-4 py-2 text-[12px] font-medium transition-all border ${
                  isActive
                    ? "border-transparent bg-[var(--color-accent)] text-white"
                    : "border-[rgba(107,31,42,0.2)] bg-[var(--color-blush)] text-[var(--color-accent)]"
                }`}
              >
                {pill.label}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Grille produits */}
      <section className="mt-7 px-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-serif text-2xl text-[var(--color-accent)]">Produits favoris</h2>
          <span className="text-[11px] text-[var(--color-muted)]">
            {visibleCount(products.length)} article{products.length > 1 ? "s" : ""}
          </span>
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted)]">
            Aucun produit favori dans cette catégorie pour le moment.
            <br />
            <Link
              href="/"
              className="mt-2 inline-block underline underline-offset-2 text-[var(--color-accent)]"
            >
              Voir toutes les catégories
            </Link>
          </div>
        ) : (
          <div id="product-grid" className="grid grid-cols-2 gap-3">
            {products.map((product) => (
              <Link
                key={product.id}
                href={`/produits/${product.id}`}
                className="flex flex-col rounded-2xl border border-[var(--color-border)] bg-white overflow-hidden"
                style={{ boxShadow: "0 4px 20px rgba(139,26,58,0.05)" }}
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
                  <p className="text-[11px] text-[var(--color-muted)] leading-snug line-clamp-2">
                    {product.description}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-[var(--color-accent)]">
                      {product.price.toLocaleString("fr-GN")} GNF
                    </span>
                    <span
                      className={`text-[10px] ${
                        product.stock > 0 ? "text-[var(--color-muted)]" : "text-red-400"
                      }`}
                    >
                      {product.stock > 0 ? "En stock" : "Rupture"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {totalCount > products.length && (
          <div className="mt-6 flex justify-center">
            <Link
              href="/produits"
              className="rounded-full border border-[var(--color-border)] px-5 py-2 text-sm font-semibold text-[var(--color-accent)]"
            >
              Voir tous les produits →
            </Link>
          </div>
        )}
      </section>

      {/* Badges de confiance */}
      <section className="mt-8 px-4 grid grid-cols-2 gap-3">
        {[
          "Livraison Conakry",
          "Produits Vérifiés",
          "Conseils Personnalisés",
          "100% Satisfait",
        ].map((label) => (
          <div
            key={label}
            className="flex items-center gap-2 rounded-xl bg-[var(--color-blush)] p-3"
          >
            <span className="text-[14px] font-semibold text-[var(--color-accent)]">{label}</span>
          </div>
        ))}
      </section>
    </main>
  );
}

function visibleCount(n: number) {
  return n;
}