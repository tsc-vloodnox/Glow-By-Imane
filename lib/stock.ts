// Destination : lib/stock.ts
// Restitution du stock réservé par une commande (annulation, suppression).

import type { Prisma } from "@prisma/client";

/**
 * Remet en stock les articles d'une commande, si elle en réservait encore.
 * À appeler DANS une transaction. Idempotent : le drapeau `stockReserved` est
 * basculé de façon atomique avant toute restitution, donc un double appel
 * (double clic, requêtes concurrentes) ne recrédite jamais deux fois.
 *
 * Kits : on restitue le contenu figé au moment de la commande (OrderItemComponent).
 * Commandes antérieures à cette fonctionnalité (aucun composant enregistré) :
 * repli sur la composition ACTUELLE du kit.
 */
export async function releaseOrderStock(tx: Prisma.TransactionClient, orderId: string) {
  const claimed = await tx.order.updateMany({
    where: { id: orderId, stockReserved: true },
    data: { stockReserved: false },
  });
  if (claimed.count === 0) return;

  const items = await tx.orderItem.findMany({
    where: { orderId },
    include: { components: true, kit: { include: { items: true } } },
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
    if (item.components.length > 0) {
      for (const component of item.components) {
        await restock(component.productId, component.productSizeId, component.quantity * item.quantity);
      }
    } else if (item.kit) {
      for (const kitItem of item.kit.items) {
        await restock(kitItem.productId, kitItem.productSizeId, kitItem.quantity * item.quantity);
      }
    } else {
      await restock(item.productId, item.productSizeId, item.quantity);
    }
  }
}

/**
 * Réserve (décrémente) le stock d'une commande qui n'en réservait pas encore :
 * commande en gros au moment de l'accord. À appeler DANS une transaction.
 *
 * Contrairement à une commande boutique, AUCUNE vérification de disponibilité :
 * le stock peut devenir négatif, la valeur négative correspondant aux unités
 * promises à réapprovisionner. Idempotent (drapeau `stockReserved` basculé
 * atomiquement). Renvoie false si le stock était déjà réservé.
 */
export async function reserveOrderStock(tx: Prisma.TransactionClient, orderId: string): Promise<boolean> {
  const claimed = await tx.order.updateMany({
    where: { id: orderId, stockReserved: false },
    data: { stockReserved: true },
  });
  if (claimed.count === 0) return false;

  const items = await tx.orderItem.findMany({
    where: { orderId },
    include: { components: true },
  });

  const reserve = async (productId: string | null, productSizeId: string | null, quantity: number) => {
    if (productSizeId) {
      await tx.productSize.updateMany({ where: { id: productSizeId }, data: { stock: { decrement: quantity } } });
    } else if (productId) {
      await tx.product.updateMany({ where: { id: productId }, data: { stock: { decrement: quantity } } });
    }
  };

  for (const item of items) {
    if (item.components.length > 0) {
      for (const component of item.components) {
        await reserve(component.productId, component.productSizeId, component.quantity * item.quantity);
      }
    } else {
      await reserve(item.productId, item.productSizeId, item.quantity);
    }
  }
  return true;
}
