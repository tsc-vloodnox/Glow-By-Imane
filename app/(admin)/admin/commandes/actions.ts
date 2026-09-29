"use server";

import { randomUUID } from "crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../actions";
import { ORDER_STATUS_CONFIG } from "@/lib/order-status";
import { GIFT_LINK_EXPIRY_DAYS, giftCardUrl } from "@/lib/gift-card";
import { releaseOrderStock } from "@/lib/stock";
import { upsertCustomer } from "@/lib/customers";
import { toInt, toJsonArray } from "@/lib/form-validation";
import { UserError, withActionResult } from "@/lib/action-result";

export type OrderStatusValue =
  | "NOUVELLE"
  | "DISCUSSION_WHATSAPP"
  | "CONFIRMEE"
  | "PREPARATION"
  | "EN_LIVRAISON"
  | "LIVREE"
  | "ANNULEE";

// ─── Statut ──────────────────────────────────────────────────────────────────

async function updateOrderStatusImpl(orderId: string, status: OrderStatusValue) {
  await requireAdmin();

  const order = await prisma.order.findUniqueOrThrow({
    where: { id: orderId },
    select: { status: true },
  });

  const allowedNext = ORDER_STATUS_CONFIG[order.status as OrderStatusValue]
    .next as readonly string[];
  if (!allowedNext.includes(status)) {
    throw new UserError(`Transition de statut invalide : ${order.status} → ${status}.`);
  }

  await prisma.$transaction(async (tx) => {
    // Mise à jour conditionnelle : échoue si le statut a changé entre-temps (autre onglet, double clic)
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: order.status },
      data: { status },
    });
    if (updated.count === 0) {
      throw new UserError("La commande a été modifiée entre-temps. Rechargez la page.");
    }

    // Annulation → les articles réservés retournent en stock
    if (status === "ANNULEE") {
      await releaseOrderStock(tx, orderId);
    }
  });
  revalidatePath("/admin/commandes");
  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/admin/livraisons");
  if (status === "ANNULEE") revalidatePath("/", "layout"); // stock visible en boutique
}

// ─── Remise ──────────────────────────────────────────────────────────────────

async function updateOrderDiscountImpl(orderId: string, formData: FormData) {
  await requireAdmin();

  const discountAmount = toInt(formData.get("discountAmount"), "Remise", { optional: true });
  const discountReason = String(formData.get("discountReason") ?? "").trim() || null;

  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } });
  if (discountAmount > order.estimatedTotal) {
    throw new UserError("La remise ne peut pas dépasser le montant de la commande.");
  }
  const finalTotal = Math.max(0, order.estimatedTotal - discountAmount);

  await prisma.order.update({
    where: { id: orderId },
    data: { discountAmount, discountReason, finalTotal },
  });

  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/admin/commandes");
}

// ─── Création admin (commandes WhatsApp / hors-app) ──────────────────────────

async function createAdminOrderImpl(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const quartier = String(formData.get("quartier") ?? "").trim();
  const comment = String(formData.get("comment") ?? "").trim() || null;
  const source = String(formData.get("source") ?? "whatsapp").trim().slice(0, 30) || "whatsapp";
  const discountAmount = toInt(formData.get("discountAmount"), "Remise", { optional: true });
  const discountReason = String(formData.get("discountReason") ?? "").trim() || null;

  // Items : JSON stringifié depuis le formulaire — revalidé ligne par ligne
  const items = toJsonArray(formData.get("items"), "Articles").map((raw) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    if (typeof item.productId !== "string" || !item.productId) throw new UserError("Article invalide.");
    return {
      productId: item.productId,
      quantity: toInt(item.quantity, "Quantité", { min: 1, max: 1000 }),
      unitPrice: toInt(item.unitPrice, "Prix unitaire"),
    };
  });

  if (!name || !phone || !quartier) {
    throw new UserError("Nom, téléphone et quartier requis.");
  }
  if (items.length === 0) {
    throw new UserError("Ajoutez au moins un article.");
  }

  const estimatedTotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  if (discountAmount > estimatedTotal) {
    throw new UserError("La remise ne peut pas dépasser le montant de la commande.");
  }
  const finalTotal = estimatedTotal - discountAmount;

  const order = await prisma.$transaction(async (tx) => {
    // Décrémentation ATOMIQUE du stock, comme pour une commande boutique :
    // échoue (et annule tout) si un produit n'a pas assez de stock.
    for (const item of items) {
      const result = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (result.count === 0) {
        const product = await tx.product.findUnique({ where: { id: item.productId }, select: { name: true, stock: true } });
        throw new UserError(
          product
            ? `Stock insuffisant pour ${product.name} (${product.stock} disponible${product.stock > 1 ? "s" : ""}).`
            : "Produit introuvable.",
        );
      }
    }

    const customerId = await upsertCustomer(tx, { phone, name, quartier });

    return tx.order.create({
      data: {
        customerId,
        name,
        phone,
        quartier,
        comment,
        source,
        estimatedTotal,
        discountAmount,
        discountReason,
        finalTotal,
        stockReserved: true, // restitué si la commande est annulée ou supprimée
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
  });

  revalidatePath("/admin/commandes");
  revalidatePath("/", "layout"); // stock visible en boutique
  redirect(`/admin/commandes/${order.id}`);
}

// ─── Suppression en masse ─────────────────────────────────────────────────────

async function deleteAllOrdersImpl(statusFilter?: OrderStatusValue) {
  await requireAdmin();

  const where = statusFilter ? { status: statusFilter } : {};

  await prisma.$transaction(
    async (tx) => {
      // Une commande supprimée avant livraison libère son stock réservé.
      // Les commandes livrées ont réellement consommé leur stock : rien à restituer.
      const toRelease = await tx.order.findMany({
        where: { ...where, stockReserved: true, status: { not: "LIVREE" } },
        select: { id: true },
      });
      for (const { id } of toRelease) {
        await releaseOrderStock(tx, id);
      }

      // Supprime d'abord les livraisons, cartes cadeau et items liés (contraintes FK)
      await tx.delivery.deleteMany({ where: { order: where } });
      await tx.giftCard.deleteMany({ where: { order: where } });
      await tx.orderItem.deleteMany({ where: { order: where } });
      await tx.order.deleteMany({ where });
    },
    { timeout: 30_000 },
  );

  revalidatePath("/admin/commandes");
  revalidatePath("/admin/livraisons");
  revalidatePath("/", "layout"); // stock visible en boutique
}

// ─── Carte cadeau ─────────────────────────────────────────────────────────────

async function updateGiftCardImpl(orderId: string, formData: FormData) {
  await requireAdmin();

  const recipientName = String(formData.get("recipientName") ?? "").trim();
  const recipientPhone = String(formData.get("recipientPhone") ?? "").trim();
  const recipientAddress = String(formData.get("recipientAddress") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim() || null;

  if (!recipientName || !recipientPhone || !recipientAddress) {
    throw new UserError("Nom, téléphone et adresse du destinataire requis.");
  }

  await prisma.giftCard.update({
    where: { orderId },
    data: { recipientName, recipientPhone, recipientAddress, message },
  });

  revalidatePath(`/admin/commandes/${orderId}`);
}

async function updateGiftCardPhotoImpl(orderId: string, photo: string) {
  await requireAdmin();
  await prisma.giftCard.update({ where: { orderId }, data: { photo } });
  revalidatePath(`/admin/commandes/${orderId}`);
}

async function publishGiftCardImpl(orderId: string) {
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

async function unpublishGiftCardImpl(orderId: string) {
  await requireAdmin();

  const giftCard = await prisma.giftCard.update({
    where: { orderId },
    data: { status: "DRAFT" },
  });

  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/admin/commandes");
  if (giftCard.token) revalidatePath(`/cadeau/${giftCard.token}`);
}

// ─── Exports ──────────────────────────────────────────────────────────────────
// Enveloppées par withActionResult : renvoient { ok, data | error } au lieu de lever
// une erreur, dont le message serait masqué par Next.js en production.
// Côté client : const x = unwrapAction(xAction) — cf. lib/action-result.ts

export const updateOrderStatus = withActionResult(updateOrderStatusImpl);
export const updateOrderDiscount = withActionResult(updateOrderDiscountImpl);
export const createAdminOrder = withActionResult(createAdminOrderImpl);
export const deleteAllOrders = withActionResult(deleteAllOrdersImpl);
export const updateGiftCard = withActionResult(updateGiftCardImpl);
export const updateGiftCardPhoto = withActionResult(updateGiftCardPhotoImpl);
export const publishGiftCard = withActionResult(publishGiftCardImpl);
export const unpublishGiftCard = withActionResult(unpublishGiftCardImpl);
