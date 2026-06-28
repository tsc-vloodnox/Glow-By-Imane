"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../actions";

export type OrderStatusValue =
  | "NOUVELLE"
  | "DISCUSSION_WHATSAPP"
  | "CONFIRMEE"
  | "PREPARATION"
  | "EN_LIVRAISON"
  | "LIVREE"
  | "ANNULEE";

// ─── Statut ──────────────────────────────────────────────────────────────────

export async function updateOrderStatus(orderId: string, status: OrderStatusValue) {
  await requireAdmin();
  await prisma.order.update({ where: { id: orderId }, data: { status } });
  revalidatePath("/admin/commandes");
  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/admin/livraisons");
}

// ─── Remise ──────────────────────────────────────────────────────────────────

export async function updateOrderDiscount(orderId: string, formData: FormData) {
  await requireAdmin();

  const discountAmount = Math.max(0, Number(formData.get("discountAmount") ?? 0));
  const discountReason = String(formData.get("discountReason") ?? "").trim() || null;

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  const finalTotal = Math.max(0, order.estimatedTotal - discountAmount);

  await prisma.order.update({
    where: { id: orderId },
    data: { discountAmount, discountReason, finalTotal },
  });

  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/admin/commandes");
}

// ─── Création admin (commandes WhatsApp / hors-app) ──────────────────────────

export async function createAdminOrder(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const quartier = String(formData.get("quartier") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim() || null;
  const source = String(formData.get("source") ?? "whatsapp");
  const discountAmount = Math.max(0, Number(formData.get("discountAmount") ?? 0));
  const discountReason = String(formData.get("discountReason") ?? "").trim() || null;

  // Items : JSON stringifié depuis le formulaire
  const itemsRaw = String(formData.get("items") ?? "[]");
  const items: Array<{ productId: string; quantity: number; unitPrice: number }> =
    JSON.parse(itemsRaw);

  if (!name || !phone || !quartier || items.length === 0) {
    throw new Error("Informations manquantes.");
  }

  const estimatedTotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const finalTotal = Math.max(0, estimatedTotal - discountAmount);

  const order = await prisma.order.create({
    data: {
      name,
      phone,
      quartier,
      comment,
      source,
      estimatedTotal,
      discountAmount,
      discountReason,
      finalTotal,
      status: "CONFIRMEE", // commande admin = déjà confirmée
      items: {
        create: items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      },
    },
  });

  revalidatePath("/admin/commandes");
  redirect(`/admin/commandes/${order.id}`);
}

// ─── Suppression en masse ─────────────────────────────────────────────────────

export async function deleteAllOrders(statusFilter?: OrderStatusValue) {
  await requireAdmin();

  const where = statusFilter ? { status: statusFilter } : {};

  // Supprime d'abord les livraisons liées (contrainte FK)
  await prisma.delivery.deleteMany({
    where: { order: where },
  });

  // Supprime les items
  await prisma.orderItem.deleteMany({
    where: { order: where },
  });

  // Supprime les commandes
  await prisma.order.deleteMany({ where });

  revalidatePath("/admin/commandes");
  revalidatePath("/admin/livraisons");
}
