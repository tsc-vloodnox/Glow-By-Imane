// Destination : lib/delivery-runs.ts
// Tournées des livreurs : position des arrêts, itinéraire estimé et coût calculé.

import type { Prisma } from "@prisma/client";

import { planRoute, runCost, type Point, type RunCostSettings } from "@/lib/delivery";
import { getDeliverySettings } from "@/lib/delivery-settings";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export const runDeliveryInclude = {
  order: {
    select: {
      id: true,
      number: true,
      name: true,
      phone: true,
      quartier: true,
      finalTotal: true,
      depositAmount: true,
      locationLat: true,
      locationLng: true,
      quartierRef: { select: { name: true, lat: true, lng: true } },
    },
  },
} satisfies Prisma.DeliveryInclude;

type RunDelivery = Prisma.DeliveryGetPayload<{ include: typeof runDeliveryInclude }>;

/** Position d'un arrêt : position partagée par la cliente, sinon centre du quartier choisi. */
export function stopPosition(delivery: RunDelivery): (Point & { precise: boolean }) | null {
  const { order } = delivery;
  if (order.locationLat != null && order.locationLng != null) {
    return { lat: order.locationLat, lng: order.locationLng, precise: true };
  }
  if (order.quartierRef) return { lat: order.quartierRef.lat, lng: order.quartierRef.lng, precise: false };
  return null;
}

/** Point de départ des tournées : le point de retrait par défaut, s'il est placé sur la carte. */
export async function getRunStart(db: Db = prisma): Promise<(Point & { name: string }) | null> {
  const pickup = await db.pickupPoint.findFirst({ where: { isDefault: true }, select: { name: true, lat: true, lng: true } });
  return pickup?.lat != null && pickup.lng != null ? { name: pickup.name, lat: pickup.lat, lng: pickup.lng } : null;
}

/**
 * Itinéraire et coût estimés d'une liste de livraisons. Les arrêts sans position
 * comptent comme arrêts mais pas en km (l'estimation est alors incomplète).
 */
export function estimateRun(deliveries: RunDelivery[], start: Point | null, settings: RunCostSettings) {
  const located = deliveries.flatMap((d) => {
    const position = stopPosition(d);
    return position ? [{ id: d.id, lat: position.lat, lng: position.lng }] : [];
  });
  const plan = start ? planRoute(start, located, settings) : null;
  // Arrêts sans position à la fin de l'ordre de passage
  const order = [...(plan?.order ?? located.map((s) => s.id)), ...deliveries.filter((d) => !stopPosition(d)).map((d) => d.id)];
  return {
    order,
    km: plan?.km ?? null,
    suggestedCost: runCost(settings, plan?.km ?? 0, deliveries.length),
    missingPositions: deliveries.length - located.length,
  };
}

/**
 * Recalcule l'estimation d'une tournée après un changement (arrêts, réglages).
 * En mode « calculé », le montant dû au livreur suit l'estimation ; en forfait il ne bouge pas.
 * Une tournée non réglée qui n'a plus d'arrêt est supprimée. Renvoie false dans ce cas.
 */
export async function recomputeRun(db: Db, runId: string): Promise<boolean> {
  const run = await db.deliveryRun.findUniqueOrThrow({
    where: { id: runId },
    include: { deliveries: { include: runDeliveryInclude } },
  });
  if (run.settledAt) return true;
  if (run.deliveries.length === 0) {
    await db.deliveryRun.delete({ where: { id: runId } });
    return false;
  }
  const [start, settings] = await Promise.all([getRunStart(db), getDeliverySettings()]);
  const estimate = estimateRun(run.deliveries, start, settings);
  await db.deliveryRun.update({
    where: { id: runId },
    data: {
      estimatedKm: estimate.km,
      suggestedCost: estimate.suggestedCost,
      cost: run.costMode === "CALCULE" ? estimate.suggestedCost : undefined,
    },
  });
  return true;
}
