"use server";

import { randomUUID } from "crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../actions";
import { ORDER_STATUS_CONFIG } from "@/lib/order-status";
import { GIFT_LINK_EXPIRY_DAYS, giftCardUrl } from "@/lib/gift-card";

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

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { status: true },
  });

  const allowedNext = ORDER_STATUS_CONFIG[order.status as OrderStatusValue]
    .next as readonly string[];
  if (!allowedNext.includes(status)) {
    throw new Error(`Transition de statut invalide : ${order.status} → ${status}.`);
  }

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

  // Supprime d'abord les livraisons et cartes cadeau liées (contrainte FK)
  await prisma.delivery.deleteMany({
    where: { order: where },
  });
  await prisma.giftCard.deleteMany({
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

// ─── Carte cadeau ─────────────────────────────────────────────────────────────

export async function updateGiftCard(orderId: string, formData: FormData) {
  await requireAdmin();

  const recipientName = String(formData.get("recipientName") ?? "").trim();
  const recipientPhone = String(formData.get("recipientPhone") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim() || null;

  if (!recipientName || !recipientPhone) {
    throw new Error("Nom et téléphone du destinataire requis.");
  }

  await prisma.giftCard.update({
    where: { orderId },
    data: { recipientName, recipientPhone, message },
  });

  revalidatePath(`/admin/commandes/${orderId}`);
}

export async function updateGiftCardPhoto(orderId: string, photo: string) {
  await requireAdmin();
  await prisma.giftCard.update({ where: { orderId }, data: { photo } });
  revalidatePath(`/admin/commandes/${orderId}`);
}

export async function publishGiftCard(orderId: string) {
  await requireAdmin();

  const existing = await prisma.giftCard.findUniqueOrThrow({ where: { orderId } });
  const token = existing.token ?? randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + GIFT_LINK_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  await prisma.giftCard.update({
    where: { orderId },
    data: { status: "PUBLISHED", token, publishedAt: now, expiresAt },
  });

  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/admin/commandes");
  revalidatePath(`/cadeau/${token}`);

  return giftCardUrl(token);
}

export async function unpublishGiftCard(orderId: string) {
  await requireAdmin();

  const giftCard = await prisma.giftCard.update({
    where: { orderId },
    data: { status: "DRAFT" },
  });

  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/admin/commandes");
  if (giftCard.token) revalidatePath(`/cadeau/${giftCard.token}`);
}
