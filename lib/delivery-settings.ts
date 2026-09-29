// Destination : lib/delivery-settings.ts
import type { RunCostSettings } from "@/lib/delivery";
import { prisma } from "@/lib/prisma";

/** Réglages du calcul des tournées (ligne unique, créée avec les valeurs par défaut si absente). */
export async function getDeliverySettings(): Promise<RunCostSettings> {
  const settings = await prisma.deliverySettings.upsert({ where: { id: "default" }, create: { id: "default" }, update: {} });
  return {
    baseFee: settings.baseFee,
    perKm: settings.perKm,
    perExtraStop: settings.perExtraStop,
    includeReturn: settings.includeReturn,
    roadFactor: settings.roadFactor,
  };
}
