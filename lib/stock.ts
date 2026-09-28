// Destination : lib/stock.ts
// Restitution du stock réservé par une commande (annulation, suppression).

import type { Prisma } from "@prisma/client";

/**
 * Remet en stock les articles d'une commande, si elle en réservait encore.
 * À appeler DANS une transaction. Idempotent : le drapeau `stockReserved` est
 * basculé de façon atomique avant toute restitution, donc un double appel
 * (double clic, requêtes concurrentes) ne recrédite jamais deux fois.
 *
 * Kits : OrderItem ne fige pas la composition du kit au moment de la commande,
 * on restitue donc selon la composition ACTUELLE du kit.
 */
export async function releaseOrderStock(tx: Prisma.TransactionClient, orderId: string) {
  const claimed = await tx.order.updateMany({
    where: { id: orderId, stockReserved: true },
    data: { stockReserved: false },
  });
  if (claimed.count === 0) return;

  const items = await tx.orderItem.findMany({
    where: { orderId },
    include: { kit: { include: { items: true } } },
  });

  // updateMany (et non update) : ne plante pas si un produit/une taille a disparu depuis
  const restock = async (productId: string | null, productSizeId: string | null, quantity: number) => {
    if (productSizeId) {
      await tx.productSize.updateMany({ where: { id: productSizeId }, data: { stock: { increment: quantity } } });
    } else if (productId) {
      await tx.product.updateMany({ where: { id: productId }, data: { stock: { increment: quantity } } });
    }
  };

  for (const item of items) {
    if (item.kit) {
      for (const kitItem of item.kit.items) {
        await restock(kitItem.productId, kitItem.productSizeId, kitItem.quantity * item.quantity);
      }
    } else {
      await restock(item.productId, item.productSizeId, item.quantity);
    }
  }
}
