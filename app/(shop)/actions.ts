"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { resolveDiscountedLineTotal, type ActivePromotion } from "@/lib/pricing";
import { buildOrderMessage } from "@/lib/whatsapp";
import { GIFT_PRINT_FEE } from "@/lib/gift-card";
import { MAX_ORDER_LINES, parseOrderInput } from "@/lib/order-validation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import type { CartItemInput, OrderInput } from "@/types/types";
import type { CartItem } from "@/lib/cart";
import { UserError, withActionResult } from "@/lib/action-result";

/** Promotions actives d'un produit à l'instant `now` (pas de promo par taille pour l'instant). */
function activePromotionsFor(
  product: { promotions: { promotion: { active: boolean; startAt: Date; endAt: Date; discountPercent: number } }[] },
  now: Date,
): ActivePromotion[] {
  return product.promotions
    .filter((pp) => pp.promotion.active && pp.promotion.startAt <= now && pp.promotion.endAt >= now)
    .map((pp) => ({ discountPercent: pp.promotion.discountPercent }));
}

// Anti-spam : limites volontairement larges pour ne jamais gêner une vraie cliente
const ORDER_LIMIT_PER_IP = 5;
const ORDER_LIMIT_PER_PHONE = 3;
const ORDER_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const TOO_MANY_ORDERS =
  "Trop de commandes envoyées en peu de temps. Merci de patienter quelques minutes ou de nous contacter sur WhatsApp.";

async function createOrderImpl(rawData: OrderInput) {
  // Les server actions sont appelables avec n'importe quel payload : on revalide tout.
  const data = parseOrderInput(rawData);

  if (!checkRateLimit(`order:${await getClientIp()}`, ORDER_LIMIT_PER_IP, ORDER_LIMIT_WINDOW_MS)) {
    throw new UserError(TOO_MANY_ORDERS);
  }

  const now = new Date();

  const recentOrdersForPhone = await prisma.order.count({
    where: { phone: data.phone, createdAt: { gte: new Date(now.getTime() - ORDER_LIMIT_WINDOW_MS) } },
  });
  if (recentOrdersForPhone >= ORDER_LIMIT_PER_PHONE) {
    throw new UserError(TOO_MANY_ORDERS);
  }

  const order = await prisma.$transaction(async (tx) => {
    const productItems = data.items.filter(
      (i): i is Extract<CartItemInput, { kind: "product" }> => i.kind === "product",
    );
    const kitItems = data.items.filter(
      (i): i is Extract<CartItemInput, { kind: "kit" }> => i.kind === "kit",
    );

    const products = await tx.product.findMany({
      where: { id: { in: productItems.map((i) => i.productId) } },
      include: { sizes: true, packPrices: true, promotions: { include: { promotion: true } } },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    const kits = await tx.kit.findMany({
      where: { id: { in: kitItems.map((i) => i.kitId) } },
      include: { items: { include: { product: true, productSize: true } } },
    });
    const kitMap = new Map(kits.map((k) => [k.id, k]));

    let estimatedTotal = 0;
    const orderItemsData: {
      productId: string | null;
      productSizeId: string | null;
      kitId: string | null;
      quantity: number;
      unitPrice: number;
    }[] = [];

    // 1. Validation + lignes produit (avec taille éventuelle)
    for (const item of productItems) {
      const product = productMap.get(item.productId);
      if (!product || product.archived) throw new UserError("Produit introuvable.");

      const size = item.productSizeId
        ? product.sizes.find((s) => s.id === item.productSizeId && !s.archived)
        : null;
      if (item.productSizeId && !size) throw new UserError(`Déclinaison indisponible pour ${product.name}.`);

      const basePrice = size ? size.price : product.price;
      const packPrices = product.packPrices
        .filter((p) => p.productSizeId === (size ? size.id : null))
        .map((p) => ({ quantity: p.quantity, price: p.price }));

      // Les promotions sont définies au niveau du produit ; pas de promo par taille dans le schéma actuel.
      const activePromotions = size ? [] : activePromotionsFor(product, now);
      const originalPrice = size ? null : product.originalPrice;

      const lineTotal = resolveDiscountedLineTotal(
        basePrice,
        activePromotions,
        packPrices,
        item.quantity,
        originalPrice,
      );
      estimatedTotal += lineTotal;

      orderItemsData.push({
        productId: product.id,
        productSizeId: size ? size.id : null,
        kitId: null,
        quantity: item.quantity,
        unitPrice: Math.round(lineTotal / item.quantity),
      });
    }

    // 2. Validation + lignes kit (pas de promotion sur les kits dans le schéma actuel)
    for (const item of kitItems) {
      const kit = kitMap.get(item.kitId);
      if (!kit || kit.archived) throw new UserError("Kit introuvable.");

      const lineTotal = kit.price * item.quantity;
      estimatedTotal += lineTotal;
      orderItemsData.push({
        productId: null,
        productSizeId: null,
        kitId: kit.id,
        quantity: item.quantity,
        unitPrice: kit.price,
      });
    }

    // 3. Décrémentation ATOMIQUE — produits/tailles directs
    for (const item of productItems) {
      const product = productMap.get(item.productId)!;
      if (item.productSizeId) {
        const result = await tx.productSize.updateMany({
          where: { id: item.productSizeId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (result.count === 0) throw new UserError(`Stock insuffisant pour ${product.name}.`);
      } else {
        const result = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (result.count === 0) throw new UserError(`Stock insuffisant pour ${product.name}.`);
      }
    }

    // 4. Décrémentation ATOMIQUE — articles composant chaque kit commandé
    for (const item of kitItems) {
      const kit = kitMap.get(item.kitId)!;
      for (const kitItem of kit.items) {
        const neededQty = kitItem.quantity * item.quantity;
        if (kitItem.productSizeId) {
          const result = await tx.productSize.updateMany({
            where: { id: kitItem.productSizeId, stock: { gte: neededQty } },
            data: { stock: { decrement: neededQty } },
          });
          if (result.count === 0) throw new UserError(`Stock insuffisant pour composer le kit "${kit.name}".`);
        } else {
          const result = await tx.product.updateMany({
            where: { id: kitItem.productId, stock: { gte: neededQty } },
            data: { stock: { decrement: neededQty } },
          });
          if (result.count === 0) throw new UserError(`Stock insuffisant pour composer le kit "${kit.name}".`);
        }
      }
    }

    // 5. Frais d'impression de la carte cadeau, s'il a été demandé
    if (data.gift?.printRequested) {
      estimatedTotal += GIFT_PRINT_FEE;
    }

    // 6. Création de la commande seulement si tout le stock a été réservé
    return tx.order.create({
      data: {
        name: data.name,
        phone: data.phone,
        quartier: data.quartier,
        comment: data.comment,
        estimatedTotal,
        finalTotal: estimatedTotal,
        stockReserved: true, // stock décrémenté ci-dessus, restitué si annulation/suppression
        items: { create: orderItemsData },
        giftCard: data.gift
          ? {
              create: {
                recipientName: data.gift.recipientName,
                recipientPhone: data.gift.recipientPhone,
                recipientAddress: data.gift.recipientAddress,
                message: data.gift.message || null,
                photo: data.gift.photo || null,
                printRequested: data.gift.printRequested ?? false,
              },
            }
          : undefined,
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true } },
            productSize: { select: { id: true, label: true } },
            kit: { select: { id: true, name: true } },
          },
        },
      },
    });
  });

  revalidatePath("/admin/commandes");

  return buildOrderMessage(
    order,
    {
      name: data.name,
      phone: data.phone,
      quartier: data.quartier,
      comment: data.comment,
    },
    data.gift?.printRequested ? GIFT_PRINT_FEE : undefined,
  );
}

/**
 * Revalide prix/stock/dispo/promotions d'un panier côté serveur avant l'affichage du checkout.
 * Reçoit le panier client tel quel (CartItem[]) et renvoie une version à jour,
 * en recalculant chaque total avec resolveDiscountedLineTotal (comme le client)
 * pour détecter fidèlement tout changement de prix, de stock ou de promotion.
 */
async function refreshCartPricesImpl(items: CartItem[]) {
  if (!Array.isArray(items) || items.length > MAX_ORDER_LINES) {
    throw new UserError("Panier invalide.");
  }
  if (items.length === 0) {
    return { items: [] as CartItem[], priceChanged: false, removedKeys: [] as string[] };
  }

  const now = new Date();
  const productIds = items.filter((i) => i.kind === "product").map((i) => i.productId!);
  const kitIds = items.filter((i) => i.kind === "kit").map((i) => i.kitId!);

  const [products, kits] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { sizes: true, packPrices: true, promotions: { include: { promotion: true } } },
    }),
    prisma.kit.findMany({
      where: { id: { in: kitIds } },
      include: {
        items: { include: { product: { select: { stock: true } }, productSize: { select: { stock: true } } } },
      },
    }),
  ]);

  const productMap = new Map(products.map((p) => [p.id, p]));
  const kitMap = new Map(kits.map((k) => [k.id, k]));

  const removedKeys: string[] = [];
  let priceChanged = false;

  const refreshedItems = items
    .map((item) => {
      const oldTotal = resolveDiscountedLineTotal(
        item.basePrice,
        item.activePromotions,
        item.packPrices,
        item.quantity,
        item.originalPrice,
      );

      if (item.kind === "kit") {
        const kit = kitMap.get(item.kitId!);
        if (!kit || kit.archived) {
          removedKeys.push(item.cartKey);
          return null;
        }
        const kitStock = kit.items.reduce((min, ki) => {
          const available = ki.productSize ? ki.productSize.stock : ki.product.stock;
          return Math.min(min, Math.floor(available / ki.quantity));
        }, Infinity);
        const quantity = Math.min(item.quantity, Math.max(kitStock, 0));
        if (kit.price * quantity !== oldTotal) priceChanged = true;

        return {
          ...item,
          name: kit.name,
          basePrice: kit.price,
          originalPrice: null,
          activePromotions: [] as ActivePromotion[], // pas de promo sur les kits dans le schéma actuel
          packPrices: [],
          quantity,
          stock: kitStock,
        };
      }

      const product = productMap.get(item.productId!);
      if (!product || product.archived) {
        removedKeys.push(item.cartKey);
        return null;
      }

      const size = item.productSizeId
        ? product.sizes.find((s) => s.id === item.productSizeId && !s.archived)
        : null;
      if (item.productSizeId && !size) {
        removedKeys.push(item.cartKey);
        return null;
      }

      const basePrice = size ? size.price : product.price;
      const stock = size ? size.stock : product.stock;
      const packPrices = product.packPrices
        .filter((p) => p.productSizeId === (size ? size.id : null))
        .map((p) => ({ quantity: p.quantity, price: p.price }));
      const activePromotions = size ? [] : activePromotionsFor(product, now);
      const originalPrice = size ? null : product.originalPrice;

      const quantity = Math.min(item.quantity, Math.max(stock, 0));
      if (resolveDiscountedLineTotal(basePrice, activePromotions, packPrices, quantity, originalPrice) !== oldTotal) {
        priceChanged = true;
      }

      return {
        ...item,
        name: size ? `${product.name} — ${size.label}` : product.name,
        sizeLabel: size ? size.label : null,
        basePrice,
        originalPrice,
        activePromotions,
        packPrices,
        quantity,
        stock,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return { items: refreshedItems, priceChanged, removedKeys };
}

// ─── Exports ──────────────────────────────────────────────────────────────────
// Enveloppées par withActionResult : renvoient { ok, data | error } au lieu de lever
// une erreur, dont le message serait masqué par Next.js en production.
// Côté client : const x = unwrapAction(xAction) — cf. lib/action-result.ts

export const createOrder = withActionResult(createOrderImpl);
export const refreshCartPrices = withActionResult(refreshCartPricesImpl);
