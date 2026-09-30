// Destination : app/admin/livraisons/reglages/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { UserError, withActionResult } from "@/lib/action-result";
import { isInGuinea, suggestFeeRange } from "@/lib/delivery";
import { getDeliverySettings } from "@/lib/delivery-settings";
import { toInt } from "@/lib/form-validation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../../actions";

const MAX_FEE = 10_000_000;

function revalidateDelivery() {
  revalidatePath("/admin/livraisons/reglages");
  revalidatePath("/commande"); // quartiers et fourchettes affichés au paiement
}

function toCoordinates(lat: unknown, lng: unknown): { lat: number; lng: number } {
  const point = { lat: Number(lat), lng: Number(lng) };
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng) || !isInGuinea(point)) {
    throw new UserError("Position invalide (hors de Guinée).");
  }
  return { lat: Math.round(point.lat * 1e5) / 1e5, lng: Math.round(point.lng * 1e5) / 1e5 };
}

/** Fourchette : bornes facultatives ; si une seule est donnée, prix fixe. */
function toFeeRange(minRaw: unknown, maxRaw: unknown): { feeMin: number | null; feeMax: number | null } {
  const blank = (v: unknown) => v === undefined || v === null || String(v).trim() === "";
  const min = blank(minRaw) ? null : toInt(minRaw, "Frais minimum", { max: MAX_FEE });
  const max = blank(maxRaw) ? null : toInt(maxRaw, "Frais maximum", { max: MAX_FEE });
  if (min != null && max != null && max < min) throw new UserError("Le maximum doit être supérieur ou égal au minimum.");
  return { feeMin: min ?? max, feeMax: max ?? min };
}

async function updatePickupPointImpl(id: string, formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim() || null;
  if (!name || name.length > 80 || (address?.length ?? 0) > 200) throw new UserError("Nom (80) ou adresse (200) invalide.");
  await prisma.pickupPoint.update({ where: { id }, data: { name, address } });
  revalidateDelivery();
}

async function movePickupPointImpl(id: string, lat: number, lng: number) {
  await requireAdmin();
  await prisma.pickupPoint.update({ where: { id }, data: toCoordinates(lat, lng) });
  revalidateDelivery();
}

const CONAKRY = { lat: 9.585, lng: -13.64 };

function quartierText(value: unknown, label: string): string {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  if (!text) throw new UserError(`${label} requis.`);
  if (text.length > 60) throw new UserError(`${label} : 60 caractères maximum.`);
  return text;
}

/** Nom de quartier déjà pris (contrainte unique) → message lisible */
function isUniqueViolation(err: unknown) {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "P2002";
}

/**
 * Crée (id null) ou modifie un quartier : nom, commune, fourchette, actif, position.
 * Position vide à la création : centre des quartiers de la même commune (à ajuster sur la carte).
 */
async function saveQuartierImpl(id: string | null, formData: FormData) {
  await requireAdmin();
  const name = quartierText(formData.get("name"), "Nom du quartier");
  const commune = quartierText(formData.get("commune"), "Commune");
  const fees = toFeeRange(formData.get("feeMin"), formData.get("feeMax"));
  const active = formData.get("active") === "on";
  const blank = (key: string) => String(formData.get(key) ?? "").trim() === "";
  let position = blank("lat") && blank("lng") ? null : toCoordinates(formData.get("lat"), formData.get("lng"));

  try {
    if (id) {
      await prisma.quartier.update({ where: { id }, data: { name, commune, ...fees, active, ...(position ?? {}) } });
    } else {
      if (!position) {
        const same = await prisma.quartier.aggregate({ where: { commune }, _avg: { lat: true, lng: true } });
        position =
          same._avg.lat != null && same._avg.lng != null
            ? { lat: Math.round(same._avg.lat * 1e5) / 1e5, lng: Math.round(same._avg.lng * 1e5) / 1e5 }
            : CONAKRY;
      }
      const last = await prisma.quartier.aggregate({ _max: { position: true } });
      await prisma.quartier.create({
        data: { name, commune, ...fees, active, ...position, position: (last._max.position ?? 0) + 1 },
      });
    }
  } catch (err) {
    if (isUniqueViolation(err)) throw new UserError(`Le quartier « ${name} » existe déjà.`);
    throw err;
  }
  revalidateDelivery();
}

/** Supprime un quartier jamais utilisé ; sinon il faut le désactiver (l'historique des commandes y fait référence). */
async function deleteQuartierImpl(id: string) {
  await requireAdmin();
  const quartier = await prisma.quartier.findUnique({ where: { id }, select: { name: true, _count: { select: { orders: true } } } });
  if (!quartier) return;
  if (quartier._count.orders > 0) {
    throw new UserError(`« ${quartier.name} » est utilisé par ${quartier._count.orders} commande(s) : désactivez-le plutôt.`);
  }
  await prisma.quartier.delete({ where: { id } });
  revalidateDelivery();
}

async function moveQuartierImpl(id: string, lat: number, lng: number) {
  await requireAdmin();
  await prisma.quartier.update({ where: { id }, data: toCoordinates(lat, lng) });
  revalidateDelivery();
}

/** Applique une même fourchette à tous les quartiers d'une commune (ou seulement à ceux qui n'en ont pas). */
async function setCommuneFeesImpl(commune: string, formData: FormData) {
  await requireAdmin();
  const fees = toFeeRange(formData.get("feeMin"), formData.get("feeMax"));
  if (fees.feeMin == null) throw new UserError("Indiquez au moins un montant.");
  const onlyEmpty = formData.get("onlyEmpty") === "on";
  const { count } = await prisma.quartier.updateMany({
    where: { commune, ...(onlyEmpty ? { feeMin: null, feeMax: null } : {}) },
    data: fees,
  });
  revalidateDelivery();
  return count;
}

async function renameCommuneImpl(from: string, to: string) {
  await requireAdmin();
  const name = quartierText(to, "Commune");
  const { count } = await prisma.quartier.updateMany({ where: { commune: from }, data: { commune: name } });
  revalidateDelivery();
  return count;
}

/** Propose une fourchette selon la distance à la boutique (quartiers sans fourchette, ou tous). */
async function suggestQuartierFeesImpl(overwrite: boolean) {
  await requireAdmin();
  const [pickup, settings, quartiers] = await Promise.all([
    prisma.pickupPoint.findFirst({ where: { isDefault: true } }),
    getDeliverySettings(),
    prisma.quartier.findMany({ where: overwrite ? {} : { feeMin: null, feeMax: null } }),
  ]);
  if (pickup?.lat == null || pickup.lng == null) {
    throw new UserError("Placez d'abord la boutique sur la carte : la suggestion part de sa position.");
  }
  const from = { lat: pickup.lat, lng: pickup.lng };
  await prisma.$transaction(
    quartiers.map((q) => prisma.quartier.update({ where: { id: q.id }, data: suggestFeeRange(settings, from, q) })),
  );
  revalidateDelivery();
  return quartiers.length;
}

async function updateDeliverySettingsImpl(formData: FormData) {
  await requireAdmin();
  const roadFactor = Number(String(formData.get("roadFactor") ?? "1.3").replace(",", "."));
  if (!Number.isFinite(roadFactor) || roadFactor < 1 || roadFactor > 2) {
    throw new UserError("Facteur route : entre 1 et 2 (1,3 conseillé).");
  }
  const data = {
    baseFee: toInt(formData.get("baseFee"), "Prise en charge", { max: MAX_FEE }),
    perKm: toInt(formData.get("perKm"), "Prix au km", { max: MAX_FEE }),
    perExtraStop: toInt(formData.get("perExtraStop"), "Supplément par arrêt", { max: MAX_FEE }),
    includeReturn: formData.get("includeReturn") === "on",
    roadFactor,
  };
  await prisma.deliverySettings.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
  revalidatePath("/admin/livraisons/reglages");
}

// ─── Exports ──────────────────────────────────────────────────────────────────
// Enveloppées par withActionResult : renvoient { ok, data | error } (cf. lib/action-result.ts)

export const updatePickupPoint = withActionResult(updatePickupPointImpl);
export const movePickupPoint = withActionResult(movePickupPointImpl);
export const saveQuartier = withActionResult(saveQuartierImpl);
export const deleteQuartier = withActionResult(deleteQuartierImpl);
export const moveQuartier = withActionResult(moveQuartierImpl);
export const setCommuneFees = withActionResult(setCommuneFeesImpl);
export const renameCommune = withActionResult(renameCommuneImpl);
export const suggestQuartierFees = withActionResult(suggestQuartierFeesImpl);
export const updateDeliverySettings = withActionResult(updateDeliverySettingsImpl);
