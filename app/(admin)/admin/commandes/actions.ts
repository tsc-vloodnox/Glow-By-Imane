"use server";

import { revalidatePath } from "next/cache";

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

export async function updateOrderStatus(orderId: string, status: OrderStatusValue) {
  await requireAdmin();

  await prisma.order.update({
    where: { id: orderId },
    data: { status },
  });

  revalidatePath("/admin/commandes");
  revalidatePath(`/admin/commandes/${orderId}`);
  revalidatePath("/admin/livraisons");
}
