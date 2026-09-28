// Destination : app/admin/categories/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../actions";
import { UserError, withActionResult } from "@/lib/action-result";

async function createCategoryImpl(name: string) {
  await requireAdmin();

  const trimmed = name.trim();
  if (!trimmed) throw new UserError("Le nom ne peut pas être vide.");

  await prisma.category.create({ data: { name: trimmed } });
  revalidatePath("/admin/categories");
}

async function renameCategoryImpl(id: string, name: string) {
  await requireAdmin();

  const trimmed = name.trim();
  if (!trimmed) throw new UserError("Le nom ne peut pas être vide.");

  await prisma.category.update({ where: { id }, data: { name: trimmed } });
  revalidatePath("/admin/categories");
  revalidatePath("/");
}

async function deleteCategoryImpl(id: string) {
  await requireAdmin();

  // Bloque la suppression si des produits sont encore rattachés
  const count = await prisma.product.count({
    where: { categoryId: id, archived: false },
  });

  if (count > 0) {
    throw new UserError(
      `Impossible de supprimer : ${count} produit${count > 1 ? "s" : ""} actif${count > 1 ? "s" : ""} dans cette catégorie. Archivez-les d'abord.`,
    );
  }

  await prisma.category.delete({ where: { id } });
  revalidatePath("/admin/categories");
  revalidatePath("/");
}

// ─── Exports ──────────────────────────────────────────────────────────────────
// Enveloppées par withActionResult : renvoient { ok, data | error } au lieu de lever
// une erreur, dont le message serait masqué par Next.js en production.
// Côté client : const x = unwrapAction(xAction) — cf. lib/action-result.ts

export const createCategory = withActionResult(createCategoryImpl);
export const renameCategory = withActionResult(renameCategoryImpl);
export const deleteCategory = withActionResult(deleteCategoryImpl);
