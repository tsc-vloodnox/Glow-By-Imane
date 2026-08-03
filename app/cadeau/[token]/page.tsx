// Destination : app/cadeau/[token]/page.tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";

import { prisma } from "@/lib/prisma";
import { buildDefaultGiftMessage } from "@/lib/gift-card";
import { catalogPath } from "@/lib/images";

type Props = { params: Promise<{ token: string }> };

// Mémoïsé (React cache) — évite d'interroger deux fois la même carte
// (une fois pour generateMetadata, une fois pour le rendu de la page).
const getGiftCard = cache(async (token: string) =>
  prisma.giftCard.findUnique({
    where: { token },
    include: {
      order: {
        include: {
          items: {
            include: {
              product: { select: { name: true } },
              kit: { select: { name: true } },
            },
          },
        },
      },
    },
  }),
);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const giftCard = await getGiftCard(token);

  const isAvailable =
    !!giftCard &&
    giftCard.status === "PUBLISHED" &&
    (!giftCard.expiresAt || giftCard.expiresAt > new Date());

  if (!isAvailable) {
    return { title: "Carte cadeau", robots: { index: false, follow: false } };
  }

  const title = `${giftCard.order.name} vous a envoyé un cadeau 🎁`;
  const description = "Découvrez votre surprise sur Glow by Imane.";
  const image = giftCard.photo ? catalogPath(giftCard.photo) : "/hero-illustration.png";

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      images: image ? [{ url: image, width: 1200, height: 630, alt: "Carte cadeau Glow by Imane" }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function GiftCardPage({ params }: Props) {
  const { token } = await params;

  const giftCard = await getGiftCard(token);

  if (!giftCard) notFound();

  const isAvailable =
    giftCard.status === "PUBLISHED" && (!giftCard.expiresAt || giftCard.expiresAt > new Date());

  if (!isAvailable) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-4xl">🎁</p>
        <h1 className="font-serif text-2xl text-[var(--color-foreground)]">
          Cette carte cadeau n&apos;est plus disponible
        </h1>
        <p className="text-sm text-[var(--color-muted)]">
          Le lien a peut-être expiré. Contactez l&apos;expéditeur pour en savoir plus.
        </p>
      </div>
    );
  }

  const items = giftCard.order.items.map((item) => ({
    name: item.kit?.name ?? item.product?.name ?? "Article",
    quantity: item.quantity,
  }));

  const photoUrl = giftCard.photo ? catalogPath(giftCard.photo) : "/hero-illustration.png";
  const message = giftCard.message ?? buildDefaultGiftMessage(giftCard.order.name, items);

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-10">
      <div className="text-center">
        <p className="text-4xl">🎁</p>
        <h1 className="mt-2 font-serif text-3xl text-[var(--color-foreground)]">
          Vous avez reçu un cadeau !
        </h1>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photoUrl ?? "/hero-illustration.png"}
          alt="Photo de la carte cadeau"
          className="h-64 w-full object-cover"
        />

        <div className="space-y-4 p-6">
          <p className="text-sm font-medium text-[var(--color-muted)]">
            Pour {giftCard.recipientName}
          </p>

          <p className="whitespace-pre-line text-base text-[var(--color-foreground)]">{message}</p>

          <div className="rounded-xl bg-[var(--color-blush)]/60 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
              Contenu du cadeau
            </p>
            <ul className="space-y-1 text-sm">
              {items.map((item, i) => (
                <li key={i}>
                  {item.quantity > 1 ? `${item.quantity}x ` : ""}
                  {item.name}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-center text-xs text-[var(--color-muted)]">
            Envoyé avec ❤️ via Glow by Imane
          </p>
        </div>
      </div>
    </div>
  );
}
