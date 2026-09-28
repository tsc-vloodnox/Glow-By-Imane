// Destination : app/admin/promotions/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../actions";
import { UserError, withActionResult } from "@/lib/action-result";
import { toDate, toInt } from "@/lib/form-validation";

/** Liste d'ids produits dédoublonnée ; refuse tout ce qui n'est pas un tableau de chaînes. */
function parseProductIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.some((id) => typeof id !== "string" || !id)) {
    throw new UserError("Sélection de produits invalide.");
  }
  return [...new Set(value as string[])];
}

export type PromotionInput = {
  name: string;
  discountPercent: number;
  startAt: string;   // ISO string
  endAt: string;     // ISO string
  productIds: string[];
};

async function createPromotionImpl(data: PromotionInput) {
  await requireAdmin();

  const name = typeof data.name === "string" ? data.name.trim() : "";
  if (!name) throw new UserError("Le nom est requis.");
  const discountPercent = toInt(data.discountPercent, "Le pourcentage", { min: 1, max: 99 });
  const startAt = toDate(data.startAt, "Date de début");
  const endAt = toDate(data.endAt, "Date de fin");
  if (endAt <= startAt) throw new UserError("La date de fin doit être après la date de début.");
  const productIds = parseProductIds(data.productIds);

  await prisma.promotion.create({
    data: {
      name,
      discountPercent,
      startAt,
      endAt,
      products: {
        create: productIds.map((productId) => ({ productId })),
      },
    },
  });

  revalidatePath("/admin/promotions");
  revalidatePath("/");
}

async function togglePromotionImpl(id: string, active: boolean) {
  await requireAdmin();

  await prisma.promotion.update({
    where: { id },
    data: { active },
  });

  revalidatePath("/admin/promotions");
  revalidatePath("/");
}

async function deletePromotionImpl(id: string) {
  await requireAdmin();

  await prisma.promotion.delete({ where: { id } });

  revalidatePath("/admin/promotions");
  revalidatePath("/");
}

async function updatePromotionProductsImpl(id: string, productIds: string[]) {
  await requireAdmin();

  // Remplace toute la sélection en une seule opération
  await prisma.$transaction([
    prisma.productPromotion.deleteMany({ where: { promotionId: id } }),
    prisma.productPromotion.createMany({
      data: parseProductIds(productIds).map((productId) => ({ promotionId: id, productId })),
    }),
  ]);

  revalidatePath("/admin/promotions");
  revalidatePath("/");
}

// ─── Exports ──────────────────────────────────────────────────────────────────
// Enveloppées par withActionResult : renvoient { ok, data | error } au lieu de lever
// une erreur, dont le message serait masqué par Next.js en production.
// Côté client : const x = unwrapAction(xAction) — cf. lib/action-result.ts

export const createPromotion = withActionResult(createPromotionImpl);
export const togglePromotion = withActionResult(togglePromotionImpl);
export const deletePromotion = withActionResult(deletePromotionImpl);
export const updatePromotionProducts = withActionResult(updatePromotionProductsImpl);
