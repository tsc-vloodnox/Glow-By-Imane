// Destination : app/(shop)/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import type { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildOrderMessage } from "@/lib/whatsapp";
import type { OrderInput } from "@/types/types";

export async function createOrder(data: OrderInput) {
  if (data.items.length === 0) {
    throw new Error("Le panier est vide.");
  }

  const order = await prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { id: { in: data.items.map((item) => item.productId) } },
    });

    const productMap = new Map(products.map((product) => [product.id, product]));
    let estimatedTotal = 0;
    const orderItems: {
      productId: string;
      quantity: number;
      unitPrice: number;
    }[] = [];

    // 1. Validation + construction des lignes de commande (prix au moment T)
    for (const item of data.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error("Produit introuvable.");
      }

      estimatedTotal += product.price * item.quantity;
      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice: product.price,
      });
    }

    // 2. Décrémentation ATOMIQUE du stock — la condition stock >= quantity
    //    est vérifiée par la base elle-même au moment de l'écriture, pas avant.
    //    Si deux commandes arrivent en même temps sur le même produit,
    //    une seule pourra décrémenter avec succès ; l'autre échoue ici
    //    et la transaction entière est annulée (rollback automatique).
    for (const item of data.items) {
      const product = productMap.get(item.productId)!;

      const result = await tx.product.updateMany({
        where: {
          id: item.productId,
          stock: { gte: item.quantity },
        },
        data: { stock: { decrement: item.quantity } },
      });

      if (result.count === 0) {
        throw new Error(`Stock insuffisant pour ${product.name}.`);
      }
    }

    // 3. Création de la commande seulement si tout le stock a été réservé avec succès
    const newOrder = await tx.order.create({
      data: {
        name: data.name,
        phone: data.phone,
        quartier: data.quartier,
        comment: data.comment,
        estimatedTotal,
        items: { create: orderItems },
      },
      include: {
        items: { include: { product: true } },
      },
    });

    return newOrder;
  });

  revalidatePath("/admin/commandes");

  return buildOrderMessage(order, {
    name: data.name,
    phone: data.phone,
    quartier: data.quartier,
    comment: data.comment,
  });
}

export async function updateOrderStatus(orderId: string, status: OrderStatus) {
  await prisma.order.update({
    where: { id: orderId },
    data: { status },
  });

  revalidatePath("/admin/commandes");
}

/**
 * Revalide les prix et la disponibilité d'un panier côté serveur, juste avant
 * l'affichage du checkout. Le panier client stocke le prix au moment de
 * l'ajout — s'il a changé en base depuis, on renvoie la valeur à jour pour
 * que le total affiché corresponde exactement à ce qui sera facturé,
 * et on signale qu'un ajustement a eu lieu.
 */
export async function refreshCartPrices(
  items: { productId: string; quantity: number; price: number }[],
) {
  if (items.length === 0) {
    return { items: [], priceChanged: false, removedProductIds: [] as string[] };
  }

  const products = await prisma.product.findMany({
    where: { id: { in: items.map((item) => item.productId) } },
  });
  const productMap = new Map(products.map((product) => [product.id, product]));

  let priceChanged = false;
  const removedProductIds: string[] = [];

  const refreshedItems = items
    .map((item) => {
      const product = productMap.get(item.productId);
      if (!product) {
        removedProductIds.push(item.productId);
        return null;
      }

      if (product.price !== item.price) {
        priceChanged = true;
      }

      return {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: Math.min(item.quantity, Math.max(product.stock, 0)),
        stock: product.stock,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return { items: refreshedItems, priceChanged, removedProductIds };
}
