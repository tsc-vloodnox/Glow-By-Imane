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

    for (const item of data.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new Error("Produit introuvable.");
      }
      if (product.stock < item.quantity) {
        throw new Error(`Stock insuffisant pour ${product.name}.`);
      }

      estimatedTotal += product.price * item.quantity;
      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice: product.price,
      });
    }

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

    for (const item of data.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }

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
