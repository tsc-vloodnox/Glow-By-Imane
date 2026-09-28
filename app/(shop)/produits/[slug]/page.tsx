import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";

import { ProductAddToCart } from "../../components/ProductAddToCart";
import { ProductViewTracker } from "../../components/ProductViewTracker";
import { ProductGallery } from "../../components/ProductGallery";
import { PriceDisplay } from "../../components/PriceDisplay";
import { prisma } from "@/lib/prisma";
import { catalogPath } from "@/lib/images";
import type { ProductPageProps } from "@/types/types";

// Promotions et stock rafraîchis au plus toutes les 60 s
export const revalidate = 60;

// Fetch partagé pour ne pas appeler Prisma deux fois (generateMetadata + page)
const getProduct = cache(async (slug: string) => {
  const now = new Date();
  // Recherche par slug ; l'id reste accepté pour les anciens liens (redirigés ci-dessous)
  return prisma.product.findFirst({
    where: { OR: [{ slug }, { id: slug }] },
    include: {
      category: true,
      sizes: { where: { archived: false }, orderBy: { position: "asc" } },
      packPrices: { orderBy: { position: "asc" } },
      // Uniquement les promotions en cours — mêmes critères que createOrder
      promotions: {
        where: { promotion: { active: true, startAt: { lte: now }, endAt: { gte: now } } },
        include: { promotion: { select: { discountPercent: true } } },
      },
    },
  });
});

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) return { title: "Produit introuvable" };

  const imageUrl = catalogPath(product.images[0]);

  return {
    title: product.name,
    description: product.description,
    alternates: { canonical: `/produits/${product.slug}` },
    openGraph: {
      title: `${product.name} | Glow by Imane`,
      description: product.description,
      url: `https://glowbyimane.com/produits/${product.slug}`,
      images: imageUrl
        ? [
            {
              url: imageUrl,
              width: 800,
              height: 1000,
              alt: product.name,
            },
          ]
        : [],
    },
    // WhatsApp lit aussi twitter:image comme fallback
    twitter: {
      card: "summary_large_image",
      title: product.name,
      description: product.description,
      images: imageUrl ? [imageUrl] : [],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    notFound();
  }

  // Ancien lien /produits/<id> → URL canonique /produits/<slug> (301, garde le référencement)
  if (slug !== product.slug) {
    permanentRedirect(`/produits/${product.slug}`);
  }

  // Toutes les photos du produit (la galerie était limitée aux 3 premières).
  // Sans photo : entrée vide → ProductImage affiche son motif de remplacement.
  const galleryImages = product.images.length > 0 ? product.images : [""];
  // Avec déclinaisons, la dispo dépend du stock des tailles, pas de product.stock
  const isOutOfStock =
    product.sizes.length > 0 ? product.sizes.every((s) => s.stock <= 0) : product.stock <= 0;

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
                size="lg"
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
                originalPrice: product.originalPrice,
              }}
              stock={product.stock}
              activePromotions={activePromotions}
              sizes={product.sizes.map((s) => ({ id: s.id, label: s.label, price: s.price, stock: s.stock }))}
              packPrices={product.packPrices.map((p) => ({
                quantity: p.quantity,
                price: p.price,
                productSizeId: p.productSizeId,
              }))}
            />
            <Link
              href="/"
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
