"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ADMIN_COOKIE_NAME, isSignedTokenValid } from "@/lib/admin-auth";
import { UserError, withActionResult } from "@/lib/action-result";
import { toDate, toInt, toJsonArray } from "@/lib/form-validation";
import { uniqueProductSlug } from "@/lib/slug";

const isBlank = (value: unknown) => value === undefined || value === null || value === "";

// ─── Helpers revalidation ────────────────────────────────────────────────────

/**
 * Invalide toutes les pages du catalogue public qui affichent des produits/kits.
 * À appeler après toute mutation produit ou kit.
 */
function revalidateCatalogue() {
  revalidatePath("/", "layout");        // layout racine (nav, panier…)
  revalidatePath("/");                  // page d'accueil
  revalidatePath("/produits");          // liste catalogue
  revalidatePath("/kits");              // liste kits si elle existe
}

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

function parseProductFormData(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const price = toInt(formData.get("price"), "Prix");
  const stock = toInt(formData.get("stock"), "Stock", { optional: true });
  const categoryId = String(formData.get("categoryId") ?? "").trim();
  const favorite = formData.get("favorite") === "on";
  const imagesField = String(formData.get("images") ?? "").trim();
  const images = imagesField.split("\n").map((s) => s.trim()).filter(Boolean);

  if (!name) throw new UserError("Le nom du produit est requis.");
  if (!categoryId) throw new UserError("La catégorie est requise.");

  const sizes: SizeInput[] = (toJsonArray(formData.get("sizes"), "Tailles") as Partial<SizeInput>[])
    .filter((s) => typeof s.label === "string" && s.label.trim().length > 0)
    .map((s) => ({
      id: typeof s.id === "string" ? s.id : undefined,
      label: (s.label as string).trim().slice(0, 50),
      price: toInt(s.price, `Prix de la taille « ${s.label} »`),
      stock: toInt(s.stock, `Stock de la taille « ${s.label} »`, { optional: true }),
      archived: s.archived === true,
    }));

  // Lignes vides (quantité et prix non renseignés) ignorées, lignes incomplètes refusées
  const packPrices: PackPriceInput[] = (toJsonArray(formData.get("packPrices"), "Paliers") as Partial<PackPriceInput>[])
    .filter((p) => !(isBlank(p.quantity) && isBlank(p.price)))
    .map((p) => ({
      id: typeof p.id === "string" ? p.id : undefined,
      quantity: toInt(p.quantity, "Quantité du palier", { min: 1 }),
      price: toInt(p.price, "Prix du palier", { min: 1 }),
      productSizeId: typeof p.productSizeId === "string" ? p.productSizeId : null,
    }));

  return { name, description, price, stock, categoryId, favorite, images, sizes, packPrices };
}

/**
 * Synchronise les déclinaisons (tailles) d'un produit avec la liste envoyée par le client.
 * - Les tailles retirées côté client sont supprimées, sauf si elles ont des commandes
 *   associées (auquel cas elles sont archivées pour préserver l'historique).
 * - Retourne une correspondance id-temporaire → id-réel, utile pour résoudre les paliers
 *   de prix qui référencent une taille tout juste créée.
 */
async function syncProductSizes(tx: Prisma.TransactionClient, productId: string, sizes: SizeInput[]) {
  const existing = await tx.productSize.findMany({
    where: { productId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((s) => s.id));
  const incomingIds = new Set(sizes.filter((s) => s.id).map((s) => s.id as string));

  const toRemove = [...existingIds].filter((id) => !incomingIds.has(id));
  for (const id of toRemove) {
    const hasOrders = await tx.orderItem.count({ where: { productSizeId: id } });
    if (hasOrders > 0) {
      await tx.productSize.update({ where: { id }, data: { archived: true } });
    } else {
      await tx.productSize.delete({ where: { id } });
    }
  }

  const tempIdMap = new Map<string, string>();

  for (const [i, s] of sizes.entries()) {
    const label = s.label.trim();
    if (s.id && existingIds.has(s.id)) {
      await tx.productSize.update({
        where: { id: s.id },
        data: { label, price: s.price, stock: s.stock, position: i, archived: s.archived ?? false },
      });
    } else {
      const created = await tx.productSize.create({
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
  tx: Prisma.TransactionClient,
  productId: string,
  packPrices: PackPriceInput[],
  sizeTempIdMap: Map<string, string>,
) {
  const existing = await tx.productPackPrice.findMany({
    where: { productId },
    select: { id: true },
  });
  const existingIds = new Set(existing.map((p) => p.id));
  const incomingIds = new Set(packPrices.filter((p) => p.id).map((p) => p.id as string));

  const toRemove = [...existingIds].filter((id) => !incomingIds.has(id));
  if (toRemove.length > 0) {
    await tx.productPackPrice.deleteMany({ where: { id: { in: toRemove } } });
  }

  for (const [i, p] of packPrices.entries()) {
    const resolvedSizeId = p.productSizeId
      ? sizeTempIdMap.get(p.productSizeId) ?? p.productSizeId
      : null;

    if (p.id && existingIds.has(p.id)) {
      await tx.productPackPrice.update({
        where: { id: p.id },
        data: { quantity: p.quantity, price: p.price, productSizeId: resolvedSizeId, position: i },
      });
    } else {
      await tx.productPackPrice.create({
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

// Synchronisations en plusieurs requêtes : délai plus large que les 5 s par défaut
const SYNC_TRANSACTION_OPTIONS = { timeout: 20_000 };

const productWithPricingInclude = {
  sizes: { orderBy: { position: "asc" as const } },
  packPrices: { orderBy: { position: "asc" as const } },
};

async function createProductImpl(formData: FormData) {
  await requireAdmin();
  const { sizes, packPrices, ...data } = parseProductFormData(formData);

  // Tout ou rien : un échec en cours de route ne laisse pas un produit à moitié enregistré
  const product = await prisma.$transaction(async (tx) => {
    const slug = await uniqueProductSlug(tx, data.name);
    const created = await tx.product.create({ data: { ...data, slug } });
    const sizeTempIdMap = await syncProductSizes(tx, created.id, sizes);
    await syncPackPrices(tx, created.id, packPrices, sizeTempIdMap);
    return created;
  }, SYNC_TRANSACTION_OPTIONS);

  revalidatePath("/admin/produits");
  revalidateCatalogue();

  return prisma.product.findUniqueOrThrow({
    where: { id: product.id },
    include: productWithPricingInclude,
  });
}

async function updateProductImpl(productId: string, formData: FormData) {
  await requireAdmin();
  const { sizes, packPrices, ...data } = parseProductFormData(formData);

  // Tout ou rien : un échec en cours de route ne laisse pas un produit à moitié modifié
  const { slug } = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({ where: { id: productId }, data });
    const sizeTempIdMap = await syncProductSizes(tx, productId, sizes);
    await syncPackPrices(tx, productId, packPrices, sizeTempIdMap);
    return updated;
  }, SYNC_TRANSACTION_OPTIONS);

  revalidatePath("/admin/produits");
  revalidateCatalogue();
  // Invalide aussi la page produit individuelle
  revalidatePath(`/produits/${slug}`);

  return prisma.product.findUniqueOrThrow({
    where: { id: productId },
    include: productWithPricingInclude,
  });
}

/**
 * Soft delete — archive le produit au lieu de le supprimer.
 * Préserve l'historique des commandes passées (OrderItem → Product).
 */
async function archiveProductImpl(productId: string) {
  await requireAdmin();
  await prisma.product.update({
    where: { id: productId },
    data: { archived: true, favorite: false },
  });
  revalidatePath("/admin/produits");
  revalidateCatalogue();
}

/**
 * Restaure un produit archivé.
 */
async function restoreProductImpl(productId: string) {
  await requireAdmin();
  await prisma.product.update({
    where: { id: productId },
    data: { archived: false },
  });
  revalidatePath("/admin/produits");
  revalidateCatalogue();
}

/**
 * Suppression définitive — uniquement pour les produits sans commandes.
 */
async function deleteProductImpl(productId: string) {
  await requireAdmin();

  const hasOrders = await prisma.orderItem.count({ where: { productId } });
  if (hasOrders > 0) {
    throw new UserError(
      "Ce produit a des commandes associées. Archivez-le plutôt que de le supprimer.",
    );
  }

  const usedInKits = await prisma.kitItem.count({ where: { productId } });
  if (usedInKits > 0) {
    throw new UserError("Ce produit fait partie d'un kit. Retirez-le du kit ou archivez-le.");
  }

  // Tailles et paliers n'ont pas de suppression en cascade : on les retire avec le produit
  await prisma.$transaction([
    prisma.productPackPrice.deleteMany({ where: { productId } }),
    prisma.productSize.deleteMany({ where: { productId } }),
    prisma.product.delete({ where: { id: productId } }),
  ]);
  revalidatePath("/admin/produits");
  revalidateCatalogue();
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
  const price = toInt(formData.get("price"), "Prix du kit");
  const imagesField = String(formData.get("images") ?? "").trim();
  const images = imagesField.split("\n").map((s) => s.trim()).filter(Boolean);

  if (!name) throw new UserError("Le nom du kit est requis.");

  const items: KitItemInput[] = (toJsonArray(formData.get("items"), "Articles du kit") as Partial<KitItemInput>[])
    .filter((i) => typeof i.productId === "string" && i.productId)
    .map((i) => ({
      id: typeof i.id === "string" ? i.id : undefined,
      productId: i.productId as string,
      productSizeId: typeof i.productSizeId === "string" ? i.productSizeId : null,
      quantity: toInt(i.quantity, "Quantité d'un article du kit", { min: 1, max: 1000 }),
    }));

  return { name, description, price, images, items };
}

/**
 * Synchronise les articles d'un kit avec la liste envoyée par le client.
 * Pas de contrainte d'historique : le contenu figé d'un kit déjà commandé vit dans
 * OrderItem (quantité + prix au moment de la commande), donc suppression directe possible.
 */
async function syncKitItems(tx: Prisma.TransactionClient, kitId: string, items: KitItemInput[]) {
  const existing = await tx.kitItem.findMany({ where: { kitId }, select: { id: true } });
  const existingIds = new Set(existing.map((i) => i.id));
  const incomingIds = new Set(items.filter((i) => i.id).map((i) => i.id as string));

  const toRemove = [...existingIds].filter((id) => !incomingIds.has(id));
  if (toRemove.length > 0) {
    await tx.kitItem.deleteMany({ where: { id: { in: toRemove } } });
  }

  for (const item of items) {
    const data = {
      kitId,
      productId: item.productId,
      productSizeId: item.productSizeId ?? null,
      quantity: item.quantity,
    };
    if (item.id && existingIds.has(item.id)) {
      await tx.kitItem.update({ where: { id: item.id }, data });
    } else {
      await tx.kitItem.create({ data });
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

async function createKitImpl(formData: FormData) {
  await requireAdmin();
  const { items, ...data } = parseKitFormData(formData);

  const kit = await prisma.$transaction(async (tx) => {
    const created = await tx.kit.create({ data });
    await syncKitItems(tx, created.id, items);
    return created;
  }, SYNC_TRANSACTION_OPTIONS);

  revalidatePath("/admin/kits");
  revalidateCatalogue();

  return prisma.kit.findUniqueOrThrow({
    where: { id: kit.id },
    include: kitWithItemsInclude,
  });
}

async function updateKitImpl(kitId: string, formData: FormData) {
  await requireAdmin();
  const { items, ...data } = parseKitFormData(formData);

  await prisma.$transaction(async (tx) => {
    await tx.kit.update({ where: { id: kitId }, data });
    await syncKitItems(tx, kitId, items);
  }, SYNC_TRANSACTION_OPTIONS);

  revalidatePath("/admin/kits");
  revalidateCatalogue();

  return prisma.kit.findUniqueOrThrow({
    where: { id: kitId },
    include: kitWithItemsInclude,
  });
}

/**
 * Soft delete — archive le kit au lieu de le supprimer.
 */
async function archiveKitImpl(kitId: string) {
  await requireAdmin();
  await prisma.kit.update({ where: { id: kitId }, data: { archived: true } });
  revalidatePath("/admin/kits");
  revalidateCatalogue();
}

/**
 * Restaure un kit archivé.
 */
async function restoreKitImpl(kitId: string) {
  await requireAdmin();
  await prisma.kit.update({ where: { id: kitId }, data: { archived: false } });
  revalidatePath("/admin/kits");
  revalidateCatalogue();
}

/**
 * Suppression définitive — uniquement pour les kits sans commandes.
 */
async function deleteKitImpl(kitId: string) {
  await requireAdmin();

  const hasOrders = await prisma.orderItem.count({ where: { kitId } });
  if (hasOrders > 0) {
    throw new UserError("Ce kit a des commandes associées. Archivez-le plutôt que de le supprimer.");
  }

  await prisma.$transaction([
    prisma.kitItem.deleteMany({ where: { kitId } }),
    prisma.kit.delete({ where: { id: kitId } }),
  ]);
  revalidatePath("/admin/kits");
  revalidateCatalogue();
}

// ─── Livraisons ───────────────────────────────────────────────────────────────

async function createDeliveryImpl(formData: FormData) {
  await requireAdmin();

  const orderId = String(formData.get("orderId") ?? "").trim();
  const scheduledAt = String(formData.get("scheduledAt") ?? "").trim();
  const livreurId = String(formData.get("livreurId") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const deliveryFee = toInt(formData.get("deliveryFee"), "Frais de livraison", { optional: true });

  if (!orderId || !scheduledAt) {
    throw new UserError("Commande et date de livraison requises.");
  }

  await prisma.delivery.create({
    data: {
      orderId,
      scheduledAt: toDate(scheduledAt, "Date de livraison"),
      livreurId,
      notes,
      deliveryFee,
    },
  });

  revalidatePath("/admin/livraisons");
  revalidatePath("/admin/commandes");
  revalidatePath(`/admin/commandes/${orderId}`);
}

async function updateDeliveryStatusImpl(
  deliveryId: string,
  status: "PLANIFIEE" | "EN_COURS" | "LIVREE" | "ECHOUEE" | "REPORTEE",
) {
  await requireAdmin();

  const current = await prisma.delivery.findUniqueOrThrow({
    where: { id: deliveryId },
    select: { order: { select: { status: true } } },
  });
  if (current.order.status === "ANNULEE") {
    throw new UserError("Cette commande est annulée : sa livraison ne peut plus changer de statut.");
  }

  const delivery = await prisma.$transaction(async (tx) => {
    const updated = await tx.delivery.update({
      where: { id: deliveryId },
      data: {
        status,
        deliveredAt: status === "LIVREE" ? new Date() : undefined,
      },
    });

    // La commande suit automatiquement le statut "Livrée" de sa livraison —
    // évite d'avoir à mettre à jour les deux statuts séparément.
    if (status === "LIVREE") {
      await tx.order.update({
        where: { id: updated.orderId },
        data: { status: "LIVREE" },
      });
    }

    return updated;
  });

  revalidatePath("/admin/livraisons");
  revalidatePath("/admin/commandes");
  revalidatePath(`/admin/commandes/${delivery.orderId}`);
}

async function updateDeliveryImpl(deliveryId: string, formData: FormData) {
  await requireAdmin();

  const scheduledAt = String(formData.get("scheduledAt") ?? "").trim();
  const livreurId = String(formData.get("livreurId") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  await prisma.delivery.update({
    where: { id: deliveryId },
    data: {
      scheduledAt: scheduledAt ? toDate(scheduledAt, "Date de livraison") : undefined,
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
async function assignLivreurImpl(deliveryIds: string[], livreurId: string | null) {
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
async function createLivreurImpl(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name || !phone) {
    throw new UserError("Nom et téléphone du livreur requis.");
  }

  const livreur = await prisma.livreur.create({ data: { name, phone, notes } });

  revalidatePath("/admin/livraisons");
  revalidatePath("/admin/livreurs");
  return livreur;
}

/**
 * Met à jour les informations d'un livreur (nom, téléphone, notes).
 */
async function updateLivreurImpl(livreurId: string, formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!name || !phone) {
    throw new UserError("Nom et téléphone du livreur requis.");
  }

  await prisma.livreur.update({ where: { id: livreurId }, data: { name, phone, notes } });

  revalidatePath("/admin/livraisons");
  revalidatePath("/admin/livreurs");
}

/**
 * Active/désactive un livreur (désactivé = n'apparaît plus dans le sélecteur
 * d'assignation, mais reste visible sur les livraisons déjà attribuées).
 */
async function toggleLivreurActiveImpl(livreurId: string, active: boolean) {
  await requireAdmin();
  await prisma.livreur.update({ where: { id: livreurId }, data: { active } });
  revalidatePath("/admin/livraisons");
  revalidatePath("/admin/livreurs");
}

/**
 * Met à jour les frais de livraison convenus pour une livraison (champ isolé,
 * modifiable en ligne depuis la vue livraisons sans repasser par updateDelivery).
 */
async function updateDeliveryFeeImpl(deliveryId: string, deliveryFee: number) {
  await requireAdmin();

  const fee = toInt(deliveryFee, "Frais de livraison");

  const delivery = await prisma.delivery.update({
    where: { id: deliveryId },
    data: { deliveryFee: fee },
  });

  revalidatePath("/admin/livraisons");
  revalidatePath("/admin/commandes");
  revalidatePath(`/admin/commandes/${delivery.orderId}`);
}

// ─── Exports ──────────────────────────────────────────────────────────────────
// Enveloppées par withActionResult : renvoient { ok, data | error } au lieu de lever
// une erreur, dont le message serait masqué par Next.js en production.
// Côté client : const x = unwrapAction(xAction) — cf. lib/action-result.ts

export const createProduct = withActionResult(createProductImpl);
export const updateProduct = withActionResult(updateProductImpl);
export const archiveProduct = withActionResult(archiveProductImpl);
export const restoreProduct = withActionResult(restoreProductImpl);
export const deleteProduct = withActionResult(deleteProductImpl);
export const createKit = withActionResult(createKitImpl);
export const updateKit = withActionResult(updateKitImpl);
export const archiveKit = withActionResult(archiveKitImpl);
export const restoreKit = withActionResult(restoreKitImpl);
export const deleteKit = withActionResult(deleteKitImpl);
export const createDelivery = withActionResult(createDeliveryImpl);
export const updateDeliveryStatus = withActionResult(updateDeliveryStatusImpl);
export const updateDelivery = withActionResult(updateDeliveryImpl);
export const assignLivreur = withActionResult(assignLivreurImpl);
export const createLivreur = withActionResult(createLivreurImpl);
export const updateLivreur = withActionResult(updateLivreurImpl);
export const toggleLivreurActive = withActionResult(toggleLivreurActiveImpl);
export const updateDeliveryFee = withActionResult(updateDeliveryFeeImpl);
