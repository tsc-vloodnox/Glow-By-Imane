// Destination : app/admin/promotions/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../actions";
import { UserError, withActionResult } from "@/lib/action-result";

export type PromotionInput = {
  name: string;
  discountPercent: number;
  startAt: string;   // ISO string
  endAt: string;     // ISO string
  productIds: string[];
};

async function createPromotionImpl(data: PromotionInput) {
  await requireAdmin();

  if (!data.name.trim()) throw new UserError("Le nom est requis.");
  if (data.discountPercent <= 0 || data.discountPercent >= 100)
    throw new UserError("Le pourcentage doit être entre 1 et 99.");
  if (new Date(data.endAt) <= new Date(data.startAt))
    throw new UserError("La date de fin doit être après la date de début.");

  await prisma.promotion.create({
    data: {
      name: data.name.trim(),
      discountPercent: data.discountPercent,
      startAt: new Date(data.startAt),
      endAt: new Date(data.endAt),
      products: {
        create: data.productIds.map((productId) => ({ productId })),
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
      data: productIds.map((productId) => ({ promotionId: id, productId })),
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
