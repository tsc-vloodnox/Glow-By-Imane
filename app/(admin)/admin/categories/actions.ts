// Destination : app/admin/categories/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../actions";

export async function createCategory(name: string) {
  await requireAdmin();

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Le nom ne peut pas être vide.");

  await prisma.category.create({ data: { name: trimmed } });
  revalidatePath("/admin/categories");
}

export async function renameCategory(id: string, name: string) {
  await requireAdmin();

  const trimmed = name.trim();
  if (!trimmed) throw new Error("Le nom ne peut pas être vide.");

  await prisma.category.update({ where: { id }, data: { name: trimmed } });
  revalidatePath("/admin/categories");
  revalidatePath("/");
}

export async function deleteCategory(id: string) {
  await requireAdmin();

  // Bloque la suppression si des produits sont encore rattachés
  const count = await prisma.product.count({
    where: { categoryId: id, archived: false },
  });

  if (count > 0) {
    throw new Error(
      `Impossible de supprimer : ${count} produit${count > 1 ? "s" : ""} actif${count > 1 ? "s" : ""} dans cette catégorie. Archivez-les d'abord.`,
    );
  }

  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/categories");
  revalidatePath("/");
}
