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

async function updateQuartierImpl(id: string, input: { feeMin: unknown; feeMax: unknown; active: boolean }) {
  await requireAdmin();
  await prisma.quartier.update({
    where: { id },
    data: { ...toFeeRange(input.feeMin, input.feeMax), active: input.active === true },
  });
  revalidateDelivery();
}

async function moveQuartierImpl(id: string, lat: number, lng: number) {
  await requireAdmin();
  await prisma.quartier.update({ where: { id }, data: toCoordinates(lat, lng) });
  revalidateDelivery();
}

async function createQuartierImpl(input: { name: unknown; commune: unknown; lat: unknown; lng: unknown }) {
  await requireAdmin();
  const name = String(input.name ?? "").trim();
  const commune = String(input.commune ?? "").trim();
  if (!name || !commune || name.length > 60 || commune.length > 60) throw new UserError("Nom et commune requis (60 caractères max).");
  const last = await prisma.quartier.aggregate({ _max: { position: true } });
  const created = await prisma.quartier.create({
    data: { name, commune, ...toCoordinates(input.lat, input.lng), position: (last._max.position ?? 0) + 1 },
  });
  revalidateDelivery();
  return created;
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
export const updateQuartier = withActionResult(updateQuartierImpl);
export const moveQuartier = withActionResult(moveQuartierImpl);
export const createQuartier = withActionResult(createQuartierImpl);
export const suggestQuartierFees = withActionResult(suggestQuartierFeesImpl);
export const updateDeliverySettings = withActionResult(updateDeliverySettingsImpl);
