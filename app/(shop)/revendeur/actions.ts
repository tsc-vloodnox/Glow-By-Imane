// Destination : app/(shop)/revendeur/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { UserError, withActionResult } from "@/lib/action-result";
import { upsertCustomer } from "@/lib/customers";
import { prisma } from "@/lib/prisma";
import { notifyNewOrder } from "@/lib/push";
import { resolveDiscountedLineTotal } from "@/lib/pricing";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { buildWholesaleMessage } from "@/lib/whatsapp";
import { parseWholesaleInput } from "@/lib/wholesale";

const REQUEST_LIMIT_PER_IP = 3;
const REQUEST_LIMIT_PER_PHONE = 3;
const REQUEST_LIMIT_WINDOW_MS = 30 * 60 * 1000;
const TOO_MANY_REQUESTS =
  "Trop de demandes envoyées en peu de temps. Merci de patienter ou de nous écrire directement sur WhatsApp.";

/**
 * Enregistre une demande revendeur (commande en gros) et renvoie le lien WhatsApp.
 * N'engage PAS le stock : il sera réservé par l'admin à la confirmation de l'accord.
 * Les prix enregistrés sont indicatifs (paliers + promos actuels) et négociables.
 */
async function createWholesaleRequestImpl(raw: unknown) {
  const data = parseWholesaleInput(raw);

  if (!(await checkRateLimit(`wholesale:${await getClientIp()}`, REQUEST_LIMIT_PER_IP, REQUEST_LIMIT_WINDOW_MS))) {
    throw new UserError(TOO_MANY_REQUESTS);
  }

  const now = new Date();
  const recentForPhone = await prisma.order.count({
    where: { kind: "GROS", phone: data.phone, createdAt: { gte: new Date(now.getTime() - REQUEST_LIMIT_WINDOW_MS) } },
  });
  if (recentForPhone >= REQUEST_LIMIT_PER_PHONE) throw new UserError(TOO_MANY_REQUESTS);

  const products = await prisma.product.findMany({
    where: { id: { in: data.items.map((i) => i.productId) }, archived: false },
    include: {
      sizes: { where: { archived: false } },
      packPrices: true,
      promotions: {
        where: { promotion: { active: true, startAt: { lte: now }, endAt: { gte: now } } },
        include: { promotion: { select: { discountPercent: true } } },
      },
    },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  let estimatedTotal = 0;
  const lines = data.items.map((item) => {
    const product = productMap.get(item.productId);
    if (!product) throw new UserError("Un des produits n'est plus disponible. Rechargez la page.");
    const size = item.productSizeId ? product.sizes.find((s) => s.id === item.productSizeId) : null;
    if (item.productSizeId && !size) throw new UserError(`Déclinaison indisponible pour ${product.name}.`);

    // Même calcul que la boutique (paliers, promo produit sans taille) : prix indicatif
    const lineTotal = resolveDiscountedLineTotal(
      size ? size.price : product.price,
      size ? [] : product.promotions.map((pp) => ({ discountPercent: pp.promotion.discountPercent })),
      product.packPrices
        .filter((p) => p.productSizeId === (size ? size.id : null))
        .map((p) => ({ quantity: p.quantity, price: p.price })),
      item.quantity,
      size ? null : product.originalPrice,
    );
    estimatedTotal += lineTotal;

    return {
      label: size ? `${product.name} — ${size.label}` : product.name,
      data: {
        productId: product.id,
        productSizeId: size ? size.id : null,
        quantity: item.quantity,
        unitPrice: Math.round(lineTotal / item.quantity),
      },
    };
  });

  const order = await prisma.$transaction(async (tx) => {
    const customerId = await upsertCustomer(tx, {
      phone: data.phone,
      name: data.name,
      quartier: data.quartier,
      businessName: data.businessName,
      isReseller: true,
    });

    return tx.order.create({
      data: {
        kind: "GROS",
        source: "revendeur",
        customerId,
        name: data.name,
        phone: data.phone,
        quartier: data.quartier,
        businessName: data.businessName ?? null,
        comment: data.comment ?? null,
        estimatedTotal,
        finalTotal: estimatedTotal,
        stockReserved: false, // réservé à la confirmation par l'admin
        items: { create: lines.map((line) => line.data) },
      },
      select: { id: true, number: true },
    });
  });

  revalidatePath("/admin/commandes");
  // Notification à l'admin après la réponse : n'ajoute aucun délai pour le revendeur
  after(() =>
    notifyNewOrder({ id: order.id, number: order.number, name: data.businessName ?? data.name, finalTotal: estimatedTotal, kind: "GROS" }),
  );

  return buildWholesaleMessage({
    number: order.number,
    estimatedTotal,
    lines: lines.map((line) => ({ label: line.label, quantity: line.data.quantity })),
    name: data.name,
    phone: data.phone,
    quartier: data.quartier,
    businessName: data.businessName,
    comment: data.comment,
  });
}

// ─── Exports ──────────────────────────────────────────────────────────────────
// Enveloppées par withActionResult : renvoient { ok, data | error } (cf. lib/action-result.ts)

export const createWholesaleRequest = withActionResult(createWholesaleRequestImpl);
