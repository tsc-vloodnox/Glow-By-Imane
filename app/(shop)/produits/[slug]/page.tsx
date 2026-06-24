import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCartButton } from "../../components/AddToCartButton";
import { prisma } from "@/lib/prisma";
import type { ProductPageProps } from "@/types/types";

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

  const product = await prisma.product.findFirst({
    where: { id: slug },
    include: { category: true },
  });

  if (!product) {
    notFound();
  }

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const getCatalogPath = (imageName: string) => {
    if (imageName.startsWith("/")) {
      return imageName;
    }

    const encodedName = encodeURIComponent(imageName);
    return supabaseUrl
      ? `${supabaseUrl}/storage/v1/object/public/catalogue/${encodedName}`
      : `/catalogue/${encodedName}`;
  };

  const galleryImages = product.images.length > 0 ? product.images.slice(0, 3) : ["/catalogue/placeholder.png"];
  const formattedPrice = `${product.price.toLocaleString("fr-GN")} GNF`;

  return (
    <div className="min-h-screen bg-[var(--color-cream)] text-[var(--foreground)]">
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-cream)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="rounded-full p-2 text-[var(--color-accent)] transition hover:bg-[var(--color-blush)]">
            <span aria-hidden="true">←</span>
          </Link>
          <h1 className="text-lg font-semibold italic text-[var(--color-accent)]">Boutique Beauté</h1>
          <Link href="/panier" className="rounded-full p-2 text-[var(--color-accent)] transition hover:bg-[var(--color-blush)]">
            <span aria-hidden="true">🛒</span>
          </Link>
        </div>
      </header>

      <main className="pb-32">
        <section className="relative">
          <div className="flex snap-x snap-mandatory overflow-x-auto">
            {galleryImages.map((imageName, index) => (
              <div key={`${imageName}-${index}`} className="w-full flex-none snap-start">
                <img
                  src={getCatalogPath(imageName)}
                  alt={`${product.name} ${index + 1}`}
                  className="aspect-[4/5] h-full w-full object-cover"
                />
              </div>
            ))}
          </div>

          <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
            {galleryImages.map((_, index) => (
              <span
                key={index}
                className={`h-2.5 w-2.5 rounded-full ${index === 0 ? "bg-[var(--color-accent)]" : "bg-[var(--color-accent)]/25"}`}
              />
            ))}
          </div>
        </section>

        <article className="relative z-10 -mt-6 rounded-t-[32px] bg-[var(--color-cream)] px-5 pt-8 shadow-[0_-12px_40px_rgba(107,31,42,0.08)]">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-rose-soft)]">
                {product.category.name}
              </p>
              <h2 className="font-serif text-3xl text-[var(--color-accent)]">{product.name}</h2>
            </div>
            <div className="text-right">
              <p className="font-serif text-3xl text-[var(--color-accent)]">{formattedPrice}</p>
              <p className="text-sm text-[var(--color-muted)]">{product.stock > 0 ? "En stock" : "Rupture"}</p>
            </div>
          </div>

          <p className="mb-8 leading-relaxed text-[var(--color-muted)]">{product.description}</p>

          <div className="mb-8 flex gap-4 overflow-x-auto pb-2">
            <div className="flex-none rounded-2xl border border-[var(--color-border)] bg-[var(--color-blush)] px-4 py-3">
              <p className="whitespace-nowrap text-sm text-[var(--color-accent)]">Paiement à la livraison</p>
            </div>
            <div className="flex-none rounded-2xl border border-[var(--color-border)] bg-[var(--color-blush)] px-4 py-3">
              <p className="whitespace-nowrap text-sm text-[var(--color-accent)]">Livraison rapide 48h</p>
            </div>
            <div className="flex-none rounded-2xl border border-[var(--color-border)] bg-[var(--color-blush)] px-4 py-3">
              <p className="whitespace-nowrap text-sm text-[var(--color-accent)]">100% Naturel</p>
            </div>
          </div>

          <div className="mb-8 space-y-3">
            <AddToCartButton
              product={{ id: product.id, name: product.name, price: product.price }}
              className="flex min-h-[56px] w-full items-center justify-center rounded-2xl bg-[var(--color-accent)] px-6 py-3 text-center text-sm font-medium text-white shadow-[0_10px_28px_rgba(107,31,42,0.2)] transition hover:opacity-95"
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
