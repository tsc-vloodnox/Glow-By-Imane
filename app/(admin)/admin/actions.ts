"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE_NAME, isSignedTokenValid } from "@/lib/admin-auth";

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function requireAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;

  if (!(await isSignedTokenValid(token))) {
    redirect("/admin/login");
  }
}

// ─── Produits ────────────────────────────────────────────────────────────────

type SizeInput = {
  id?: string; // id réel (cuid) si existant, id temporaire "tmp_..." si nouveau
  label: string;
  price: number;
  stock: number;
  archived?: boolean;
};

type PackPriceInput = {
  id?: string;
  quantity: number;
  price: number;
  productSizeId?: string | null; // référence un SizeInput.id (réel ou temporaire)
};

function parseJsonField<T>(raw: FormDataEntryValue | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return fallback;
  }
}

function parseProductFormData(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price = Number(formData.get("price") ?? 0);
  const stock = Number(formData.get("stock") ?? 0);
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const favorite = formData.get("favorite") === "on";
  const imagesField = String(formData.get("images") ?? "").trim();
  const images = imagesField.split("\n").map((s) => s.trim()).filter(Boolean);

  if (!name || !categoryId || Number.isNaN(price) || Number.isNaN(stock)) {
    throw new Error("Informations invalides.");
  }

  const sizes = parseJsonField<SizeInput[]>(formData.get("sizes"), []).filter(
    (s) => s.label && s.label.trim().length > 0,
  );
  const packPrices = parseJsonField<PackPriceInput[]>(formData.get("packPrices"), []).filter(
    (p) => p.quantity > 0 && p.price > 0,
  );

  return { name, description, price, stock, categoryId, favorite, images, sizes, packPrices };
}

/**
 * Synchronise les déclinaisons (tailles) d'un produit avec la liste envoyée par le client.
 * - Les tailles retirées côté client sont supprimées, sauf si elles ont des commandes
 *   associées (auquel cas elles sont archivées pour préserver l'historique).
 * - Retourne une correspondance id-temporaire → id-réel, utile pour résoudre les paliers
 *   de prix qui référencent une taille tout juste créée.
 */
async function syncProductSizes(productId: string, sizes: SizeInput[]) {
  const existing = await prisma.productSize.findMany({
    where: { productId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((s) => s.id));
  const incomingIds = new Set(sizes.filter((s) => s.id).map((s) => s.id as string));

  const toRemove = [...existingIds].filter((id) => !incomingIds.has(id));
  for (const id of toRemove) {
    const hasOrders = await prisma.orderItem.count({ where: { productSizeId: id } });
    if (hasOrders > 0) {
      await prisma.productSize.update({ where: { id }, data: { archived: true } });
    } else {
      await prisma.productSize.delete({ where: { id } });
    }
  }

  const tempIdMap = new Map<string, string>();

  for (const [i, s] of sizes.entries()) {
    const label = s.label.trim();
    if (s.id && existingIds.has(s.id)) {
      await prisma.productSize.update({
        where: { id: s.id },
        data: { label, price: s.price, stock: s.stock, position: i, archived: s.archived ?? false },
      });
    } else {
      const created = await prisma.productSize.create({
        data: {
          productId,
          label,
          price: s.price,
          stock: s.stock,
          position: i,
          archived: s.archived ?? false,
        },
      });
      if (s.id) tempIdMap.set(s.id, created.id);
    }
  }

  return tempIdMap;
}

/**
 * Synchronise les paliers de prix (quantité → prix total) d'un produit.
 * Pas de contrainte d'historique : les paliers ne sont jamais référencés par OrderItem
 * (le prix est figé dans OrderItem.unitPrice au moment de la commande), donc suppression
 * directe possible.
 */
async function syncPackPrices(
  productId: string,
  packPrices: PackPriceInput[],
  sizeTempIdMap: Map<string, string>,
) {
  const existing = await prisma.productPackPrice.findMany({
    where: { productId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((p) => p.id));
  const incomingIds = new Set(packPrices.filter((p) => p.id).map((p) => p.id as string));

  const toRemove = [...existingIds].filter((id) => !incomingIds.has(id));
  if (toRemove.length > 0) {
    await prisma.productPackPrice.deleteMany({ where: { id: { in: toRemove } } });
  }

  for (const [i, p] of packPrices.entries()) {
    const resolvedSizeId = p.productSizeId
      ? sizeTempIdMap.get(p.productSizeId) ?? p.productSizeId
      : null;

    if (p.id && existingIds.has(p.id)) {
      await prisma.productPackPrice.update({
        where: { id: p.id },
        data: { quantity: p.quantity, price: p.price, productSizeId: resolvedSizeId, position: i },
      });
    } else {
      await prisma.productPackPrice.create({
        data: {
          productId,
          quantity: p.quantity,
          price: p.price,
          productSizeId: resolvedSizeId,
          position: i,
        },
      });
    }
  }
}

const productWithPricingInclude = {
  sizes: { orderBy: { position: "asc" as const } },
  packPrices: { orderBy: { position: "asc" as const } },
};

export async function createProduct(formData: FormData) {
  await requireAdmin();
  const { sizes, packPrices, ...data } = parseProductFormData(formData);

  const product = await prisma.product.create({ data });
  const sizeTempIdMap = await syncProductSizes(product.id, sizes);
  await syncPackPrices(product.id, packPrices, sizeTempIdMap);

  revalidatePath("/admin/produits");

  return prisma.product.findUniqueOrThrow({
    where: { id: product.id },
    include: productWithPricingInclude,
  });
}

export async function updateProduct(productId: string, formData: FormData) {
  await requireAdmin();
  const { sizes, packPrices, ...data } = parseProductFormData(formData);

  await prisma.product.update({ where: { id: productId }, data });
  const sizeTempIdMap = await syncProductSizes(productId, sizes);
  await syncPackPrices(productId, packPrices, sizeTempIdMap);

  revalidatePath("/admin/produits");

  return prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: productWithPricingInclude,
  });
}

/**
 * Soft delete — archive le produit au lieu de le supprimer.
 * Préserve l'historique des commandes passées (OrderItem → Product).
 */
export async function archiveProduct(productId: string) {
  await requireAdmin();
  await prisma.product.update({
    where: { id: productId },
    data: { archived: true, favorite: false },
  });
  revalidatePath("/admin/produits");
}

/**
 * Restaure un produit archivé.
 */
export async function restoreProduct(productId: string) {
  await requireAdmin();
  await prisma.product.update({
    where: { id: productId },
    data: { archived: false },
  });
  revalidatePath("/admin/produits");
}

/**
 * Suppression définitive — uniquement pour les produits sans commandes.
 */
export async function deleteProduct(productId: string) {
  await requireAdmin();

  const hasOrders = await prisma.orderItem.count({ where: { productId } });
  if (hasOrders > 0) {
    throw new Error(
      "Ce produit a des commandes associées. Archivez-le plutôt que de le supprimer.",
    );
  }

  await prisma.product.delete({ where: { id: productId } });
  revalidatePath("/admin/produits");
}

// ─── Kits ────────────────────────────────────────────────────────────────────

type KitItemInput = {
  id?: string; // id réel si existant, "tmp_..." si pas encore enregistré
  productId: string;
  productSizeId?: string | null;
  quantity: number;
};

function parseKitFormData(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const price = Number(formData.get("price") ?? 0);
  const imagesField = String(formData.get("images") ?? "").trim();
  const images = imagesField.split("\n").map((s) => s.trim()).filter(Boolean);

  if (!name || Number.isNaN(price)) {
    throw new Error("Informations invalides.");
  }

  const items = parseJsonField<KitItemInput[]>(formData.get("items"), []).filter(
    (i) => i.productId && i.quantity > 0,
  );

  return { name, description, price, images, items };
}

/**
 * Synchronise les articles d'un kit avec la liste envoyée par le client.
 * Pas de contrainte d'historique : le contenu figé d'un kit déjà commandé vit dans
 * OrderItem (quantité + prix au moment de la commande), donc suppression directe possible.
 */
async function syncKitItems(kitId: string, items: KitItemInput[]) {
  const existing = await prisma.kitItem.findMany({ where: { kitId }, select: { id: true } });
  const existingIds = new Set(existing.map((i) => i.id));
  const incomingIds = new Set(items.filter((i) => i.id).map((i) => i.id as string));

  const toRemove = [...existingIds].filter((id) => !incomingIds.has(id));
  if (toRemove.length > 0) {
    await prisma.kitItem.deleteMany({ where: { id: { in: toRemove } } });
  }

  for (const item of items) {
    const data = {
      kitId,
      productId: item.productId,
      productSizeId: item.productSizeId ?? null,
      quantity: item.quantity,
    };
    if (item.id && existingIds.has(item.id)) {
      await prisma.kitItem.update({ where: { id: item.id }, data });
    } else {
      await prisma.kitItem.create({ data });
    }
  }
}

const kitWithItemsInclude = {
  items: {
    include: {
      product: { select: { id: true, name: true } },
      productSize: { select: { id: true, label: true } },
    },
  },
};

export async function createKit(formData: FormData) {
  await requireAdmin();
  const { items, ...data } = parseKitFormData(formData);

  const kit = await prisma.kit.create({ data });
  await syncKitItems(kit.id, items);

  revalidatePath("/admin/kits");

  return prisma.kit.findUniqueOrThrow({
    where: { id: kit.id },
    include: kitWithItemsInclude,
  });
}

export async function updateKit(kitId: string, formData: FormData) {
  await requireAdmin();
  const { items, ...data } = parseKitFormData(formData);

  await prisma.kit.update({ where: { id: kitId }, data });
  await syncKitItems(kitId, items);

  revalidatePath("/admin/kits");

  return prisma.kit.findUniqueOrThrow({
    where: { id: kitId },
    include: kitWithItemsInclude,
  });
}

/**
 * Soft delete — archive le kit au lieu de le supprimer.
 */
export async function archiveKit(kitId: string) {
  await requireAdmin();
  await prisma.kit.update({ where: { id: kitId }, data: { archived: true } });
  revalidatePath("/admin/kits");
}

/**
 * Restaure un kit archivé.
 */
export async function restoreKit(kitId: string) {
  await requireAdmin();
  await prisma.kit.update({ where: { id: kitId }, data: { archived: false } });
  revalidatePath("/admin/kits");
}

/**
 * Suppression définitive — uniquement pour les kits sans commandes.
 */
export async function deleteKit(kitId: string) {
  await requireAdmin();

  const hasOrders = await prisma.orderItem.count({ where: { kitId } });
  if (hasOrders > 0) {
    throw new Error("Ce kit a des commandes associées. Archivez-le plutôt que de le supprimer.");
  }

  await prisma.kitItem.deleteMany({ where: { kitId } });
  await prisma.kit.delete({ where: { id: kitId } });
  revalidatePath("/admin/kits");
}

// ─── Livraisons ───────────────────────────────────────────────────────────────

export async function createDelivery(formData: FormData) {
  await requireAdmin();

  const orderId = String(formData.get("orderId") ?? "").trim();
  const scheduledAt = String(formData.get("scheduledAt") ?? "").trim();
  const livreurId = String(formData.get("livreurId") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!orderId || !scheduledAt) {
    throw new Error("Commande et date de livraison requises.");
  }

  await prisma.delivery.create({
    data: {
      orderId,
      scheduledAt: new Date(scheduledAt),
      livreurId,
      notes,
    },
  });

  revalidatePath("/admin/livraisons");
  revalidatePath("/admin/commandes");
}

export async function updateDeliveryStatus(
  deliveryId: string,
  status: "PLANIFIEE" | "EN_COURS" | "LIVREE" | "ECHOUEE" | "REPORTEE",
) {
  await requireAdmin();

  await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      status,
      deliveredAt: status === "LIVREE" ? new Date() : undefined,
    },
  });

  revalidatePath("/admin/livraisons");
}

export async function updateDelivery(deliveryId: string, formData: FormData) {
  await requireAdmin();

  const scheduledAt = String(formData.get("scheduledAt") ?? "").trim();
  const livreurId = String(formData.get("livreurId") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      livreurId,
      notes,
    },
  });

  revalidatePath("/admin/livraisons");
}

// ─── Livreurs ───────────────────────────────────────────────────────────────

/**
 * Assigne (ou retire, si livreurId est null) un livreur à un lot de livraisons.
 * C'est le cœur du flux "sélectionner des commandes et les attribuer à un livreur".
 */
export async function assignLivreur(deliveryIds: string[], livreurId: string | null) {
  await requireAdmin();

  if (deliveryIds.length === 0) return;

  await prisma.delivery.updateMany({
    where: { id: { in: deliveryIds } },
    data: { livreurId },
  });

  revalidatePath("/admin/livraisons");
}

/**
 * Crée un nouveau livreur à la volée (depuis la barre d'assignation par exemple).
 */
export async function createLivreur(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name || !phone) {
    throw new Error("Nom et téléphone du livreur requis.");
  }

  const livreur = await prisma.livreur.create({ data: { name, phone, notes } });

  revalidatePath("/admin/livraisons");
  revalidatePath("/admin/livreurs");
  return livreur;
}

/**
 * Met à jour les informations d'un livreur (nom, téléphone, notes).
 */
export async function updateLivreur(livreurId: string, formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name || !phone) {
    throw new Error("Nom et téléphone du livreur requis.");
  }

  await prisma.livreur.update({ where: { id: livreurId }, data: { name, phone, notes } });

  revalidatePath("/admin/livraisons");
  revalidatePath("/admin/livreurs");
}

/**
 * Active/désactive un livreur (désactivé = n'apparaît plus dans le sélecteur
 * d'assignation, mais reste visible sur les livraisons déjà attribuées).
 */
export async function toggleLivreurActive(livreurId: string, active: boolean) {
  await requireAdmin();
  await prisma.livreur.update({ where: { id: livreurId }, data: { active } });
  revalidatePath("/admin/livraisons");
  revalidatePath("/admin/livreurs");
}

/**
 * Met à jour les frais de livraison convenus pour une livraison (champ isolé,
 * modifiable en ligne depuis la vue livraisons sans repasser par updateDelivery).
 */
export async function updateDeliveryFee(deliveryId: string, deliveryFee: number) {
  await requireAdmin();

  if (!Number.isFinite(deliveryFee) || deliveryFee < 0) {
    throw new Error("Frais de livraison invalides.");
  }

  await prisma.delivery.update({
    where: { id: deliveryId },
    data: { deliveryFee },
  });

  revalidatePath("/admin/livraisons");
}
