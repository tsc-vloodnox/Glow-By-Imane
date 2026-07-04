// Destination : app/(shop)/kits/[id]/page.tsx
import Link from "next/link";
import { notFound } from "next/navigation";

import { computeKitStock } from "../../components/KitCard";
import { KitAddToCart } from "../../components/KitAddToCart";
import { prisma } from "@/lib/prisma";

type KitPageProps = { params: Promise<{ id: string }> };

function getCatalogPath(imageName: string) {
  if (imageName.startsWith("/")) return imageName;
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const encodedName = encodeURIComponent(imageName);
  return supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/public/catalogue/${encodedName}`
    : `/catalogue/${encodedName}`;
}

export default async function KitPage({ params }: KitPageProps) {
  const { id } = await params;

  const kit = await prisma.kit.findFirst({
    where: { id, archived: false },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, stock: true } },
          productSize: { select: { id: true, label: true, stock: true } },
        },
      },
    },
  });

  if (!kit) notFound();

  const stock = Math.max(computeKitStock(kit), 0);
  const galleryImages = kit.images;

  return (
    <div className="min-h-screen bg-[var(--color-cream)] text-[var(--foreground)]">
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-cream)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/kits" className="rounded-full p-2 text-[var(--color-accent)] transition hover:bg-[var(--color-blush)]">
            <span aria-hidden="true">←</span>
          </Link>
          <h1 className="text-lg font-semibold italic text-[var(--color-accent)]">Boutique Beauté</h1>
          <Link href="/panier" className="rounded-full p-2 text-[var(--color-accent)] transition hover:bg-[var(--color-blush)]">
            <span aria-hidden="true">🛒</span>
          </Link>
        </div>
      </header>

      <main className="pb-32">
        {galleryImages.length > 0 ? (
          <section className="relative">
            <div className="flex snap-x snap-mandatory overflow-x-auto">
              {galleryImages.map((imageName, index) => (
                <div key={`${imageName}-${index}`} className="w-full flex-none snap-start">
                  <img
                    src={getCatalogPath(imageName)}
                    alt={`${kit.name} ${index + 1}`}
                    className="aspect-[4/5] h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <article className="relative z-10 -mt-6 rounded-t-[32px] bg-[var(--color-cream)] px-5 pt-8 shadow-[0_-12px_40px_rgba(107,31,42,0.08)]">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="space-y-1">
              <span className="inline-block rounded-full bg-[var(--color-gold)] px-3 py-1 text-[10px] font-medium text-white">
                Kit
              </span>
              <h2 className="font-serif text-3xl text-[var(--color-accent)]">{kit.name}</h2>
            </div>
            <div className="text-right">
              <p className="font-serif text-3xl text-[var(--color-accent)]">
                {kit.price.toLocaleString("fr-GN")} GNF
              </p>
              <p className="text-sm text-[var(--color-muted)]">{stock > 0 ? "En stock" : "Rupture"}</p>
            </div>
          </div>

          {kit.description ? (
            <p className="mb-6 leading-relaxed text-[var(--color-muted)]">{kit.description}</p>
          ) : null}

          <div className="mb-8 rounded-2xl border border-[var(--color-border)] bg-white p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Contenu du kit
            </p>
            <ul className="space-y-2 text-sm text-[var(--color-foreground)]">
              {kit.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between">
                  <span>
                    {item.product.name}
                    {item.productSize ? ` — ${item.productSize.label}` : ""}
                  </span>
                  <span className="text-[var(--color-muted)]">x{item.quantity}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mb-8 space-y-3">
            <KitAddToCart kit={{ id: kit.id, name: kit.name, price: kit.price }} stock={stock} />
            <Link
              href="/kits"
              className="flex h-[52px] items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium text-[var(--color-accent)]"
            >
              Voir d&apos;autres kits
            </Link>
          </div>
        </article>
      </main>
    </div>
  );
}