"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE_NAME, isSignedTokenValid } from "@/lib/admin-auth";

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!(await isSignedTokenValid(token))) {
    redirect("/admin/login");
  }
}

// ─── Produits ────────────────────────────────────────────────────────────────

function parseProductFormData(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);
  const stock = Number(formData.get("stock") ?? 0);
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const favorite = formData.get("favorite") === "on";
  const imagesField = String(formData.get("images") ?? "").trim();
  const images = imagesField.split("\n").map((s) => s.trim()).filter(Boolean);

  if (!name || !categoryId || Number.isNaN(price) || Number.isNaN(stock)) {
    throw new Error("Informations invalides.");
  }

  return { name, description, price, stock, categoryId, favorite, images };
}

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const data = parseProductFormData(formData);
  await prisma.product.create({ data });
  revalidatePath("/admin/produits");
}

export async function updateProduct(productId: string, formData: FormData) {
  await requireAdmin();
  const data = parseProductFormData(formData);
  await prisma.product.update({ where: { id: productId }, data });
  revalidatePath("/admin/produits");
}

/**
 * Soft delete — archive le produit au lieu de le supprimer.
 * Préserve l'historique des commandes passées (OrderItem → Product).
 */
export async function archiveProduct(productId: string) {
  await requireAdmin();
  await prisma.product.update({
    where: { id: productId },
    data: { archived: true, favorite: false },
  });
  revalidatePath("/admin/produits");
}

/**
 * Restaure un produit archivé.
 */
export async function restoreProduct(productId: string) {
  await requireAdmin();
  await prisma.product.update({
    where: { id: productId },
    data: { archived: false },
  });
  revalidatePath("/admin/produits");
}

/**
 * Suppression définitive — uniquement pour les produits sans commandes.
 */
export async function deleteProduct(productId: string) {
  await requireAdmin();

  const hasOrders = await prisma.orderItem.count({ where: { productId } });
  if (hasOrders > 0) {
    throw new Error(
      "Ce produit a des commandes associées. Archivez-le plutôt que de le supprimer.",
    );
  }

  await prisma.product.delete({ where: { id: productId } });
  revalidatePath("/admin/produits");
}

// ─── Livraisons ───────────────────────────────────────────────────────────────

export async function createDelivery(formData: FormData) {
  await requireAdmin();

  const orderId = String(formData.get("orderId") ?? "").trim();
  const scheduledAt = String(formData.get("scheduledAt") ?? "").trim();
  const livreur = String(formData.get("livreur") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!orderId || !scheduledAt) {
    throw new Error("Commande et date de livraison requises.");
  }

  await prisma.delivery.create({
    data: {
      orderId,
      scheduledAt: new Date(scheduledAt),
      livreur,
      notes,
    },
  });

  revalidatePath("/admin/livraisons");
  revalidatePath("/admin/commandes");
}

export async function updateDeliveryStatus(
  deliveryId: string,
  status: "PLANIFIEE" | "EN_COURS" | "LIVREE" | "ECHOUEE" | "REPORTEE",
) {
  await requireAdmin();

  await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      status,
      deliveredAt: status === "LIVREE" ? new Date() : undefined,
    },
  });

  revalidatePath("/admin/livraisons");
}

export async function updateDelivery(deliveryId: string, formData: FormData) {
  await requireAdmin();

  const scheduledAt = String(formData.get("scheduledAt") ?? "").trim();
  const livreur = String(formData.get("livreur") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      livreur,
      notes,
    },
  });

  revalidatePath("/admin/livraisons");
}
