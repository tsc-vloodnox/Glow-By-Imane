// Destination : lib/slug.ts
// Slugs lisibles pour les URLs produit : "Crème Lèvres Rosées" → "creme-levres-rosees".

import type { Prisma } from "@prisma/client";

const MAX_SLUG_LENGTH = 80;

export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // retire les accents
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, "");
}

/**
 * Slug unique pour un nouveau produit : ajoute -2, -3… en cas de doublon.
 * Le slug d'un produit existant n'est jamais régénéré (renommer le produit ne casse
 * pas les liens déjà partagés sur WhatsApp / Facebook).
 */
export async function uniqueProductSlug(tx: Prisma.TransactionClient, name: string): Promise<string> {
  const base = slugify(name) || "produit";
  const taken = new Set(
    (
      await tx.product.findMany({
        where: { slug: { startsWith: base } },
        select: { slug: true },
      })
    ).map((p) => p.slug),
  );

  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
