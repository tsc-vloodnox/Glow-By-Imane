// Destination : app/admin/promotions/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../actions";

export type PromotionInput = {
  name: string;
  discountPercent: number;
  startAt: string;   // ISO string
  endAt: string;     // ISO string
  productIds: string[];
};

export async function createPromotion(data: PromotionInput) {
  await requireAdmin();

  if (!data.name.trim()) throw new Error("Le nom est requis.");
  if (data.discountPercent <= 0 || data.discountPercent >= 100)
    throw new Error("Le pourcentage doit être entre 1 et 99.");
  if (new Date(data.endAt) <= new Date(data.startAt))
    throw new Error("La date de fin doit être après la date de début.");

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

export async function togglePromotion(id: string, active: boolean) {
  await requireAdmin();

  await prisma.promotion.update({
    where: { id },
    data: { active },
  });

  revalidatePath("/admin/promotions");
  revalidatePath("/");
}

export async function deletePromotion(id: string) {
  await requireAdmin();

  await prisma.promotion.delete({ where: { id } });

  revalidatePath("/admin/promotions");
  revalidatePath("/");
}

export async function updatePromotionProducts(id: string, productIds: string[]) {
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
