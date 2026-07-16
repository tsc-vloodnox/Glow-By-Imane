// Destination : app/(shop)/produits/[slug]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";

import { ProductAddToCart } from "../../components/ProductAddToCart";
import { ProductViewTracker } from "../../components/ProductViewTracker";

import { ProductGallery } from "../../components/ProductGallery";
import { PriceDisplay } from "../../components/PriceDisplay";
import { prisma } from "@/lib/prisma";
import type { ProductPageProps } from "@/types/types";

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

  const product = await prisma.product.findUnique({
    where: { id: slug },
    include: { category: true, promotions: { include: { promotion: true } } },
  });

  if (!product) {
    notFound();
  }

  const galleryImages =
    product.images.length > 0
      ? product.images.slice(0, 3)
      : ["/catalogue/placeholder.png"];
  const isOutOfStock = product.stock <= 0;
  
  // Extrait les pourcentages de remise des promotions actives reçues du serveur
  const activePromotions = (product.promotions ?? []).map((p) => ({
    discountPercent: p.promotion.discountPercent,
  }));
  return (
    <div className="min-h-screen bg-[var(--color-cream)] text-[var(--foreground)]">
      <Link
        href="/"
        className="absolute left-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[var(--color-accent)] shadow-md backdrop-blur"
        aria-label="Retour à l'accueil"
      >
        <span aria-hidden="true">←</span>
      </Link>

      <main className="pb-32">
        <ProductViewTracker
          id={product.id}
          name={product.name}
          price={product.price}
        />
        <ProductGallery images={galleryImages} productName={product.name} />

        <article className="relative z-10 -mt-6 rounded-t-[32px] bg-[var(--color-cream)] px-5 pt-8 shadow-[0_-12px_40px_rgba(107,31,42,0.08)]">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-rose-soft)]">
                {product.category.name}
              </p>
              <h2 className="font-serif text-3xl text-[var(--color-accent)]">
                {product.name}
              </h2>
            </div>
            <div className="text-right">
              <PriceDisplay
                price={product.price}
                originalPrice={product.originalPrice}
                activePromotions={activePromotions}
              />
              <p
                className={`mt-1 text-sm ${isOutOfStock ? "text-red-500" : "text-[var(--color-muted)]"}`}
              >
                {isOutOfStock ? "Rupture de stock" : "En stock"}
              </p>
            </div>
          </div>

          <p className="mb-8 leading-relaxed text-[var(--color-muted)]">
            {product.description}
          </p>

          <div className="mb-8 flex gap-4 overflow-x-auto pb-2">
            <div className="flex-none rounded-2xl border border-[var(--color-border)] bg-[var(--color-blush)] px-4 py-3">
              <p className="whitespace-nowrap text-sm text-[var(--color-accent)]">
                Paiement à la livraison
              </p>
            </div>
            <div className="flex-none rounded-2xl border border-[var(--color-border)] bg-[var(--color-blush)] px-4 py-3">
              <p className="whitespace-nowrap text-sm text-[var(--color-accent)]">
                Livraison rapide 48h
              </p>
            </div>
            <div className="flex-none rounded-2xl border border-[var(--color-border)] bg-[var(--color-blush)] px-4 py-3">
              <p className="whitespace-nowrap text-sm text-[var(--color-accent)]">
                100% Naturel
              </p>
            </div>
          </div>

          <div className="mb-8 space-y-3">
            <ProductAddToCart
              product={{
                id: product.id,
                name: product.name,
                price: product.price,
              }}
              stock={product.stock}
            />
            <Link
              href="/produits"
              className="flex h-[52px] items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-accent)]"
            >
              Voir d&apos;autres produits
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}
