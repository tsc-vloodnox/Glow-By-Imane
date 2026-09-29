// Destination : app/admin/livraisons/tournees/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { UserError, withActionResult } from "@/lib/action-result";
import { runSettlement } from "@/lib/delivery";
import { recomputeRun } from "@/lib/delivery-runs";
import { toInt } from "@/lib/form-validation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../../actions";

const MAX_STOPS = 40;

function revalidateRuns(runId?: string) {
  revalidatePath("/admin/livraisons");
  revalidatePath("/admin/livraisons/tournees");
  if (runId) revalidatePath(`/admin/livraisons/tournees/${runId}`);
}

async function unsettledRun(runId: string) {
  const run = await prisma.deliveryRun.findUnique({ where: { id: runId } });
  if (!run) throw new UserError("Tournée introuvable.");
  if (run.settledAt) throw new UserError("Cette tournée est déjà réglée : annulez le règlement pour la modifier.");
  return run;
}

/**
 * Regroupe des livraisons en une tournée (un déplacement du livreur). Les livraisons
 * passent au livreur choisi ; celles qui étaient dans une autre tournée non réglée la quittent.
 */
async function createRunImpl(deliveryIds: string[], livreurId: string) {
  await requireAdmin();
  if (!Array.isArray(deliveryIds) || deliveryIds.length === 0) throw new UserError("Sélectionnez au moins une livraison.");
  if (deliveryIds.length > MAX_STOPS) throw new UserError(`Pas plus de ${MAX_STOPS} arrêts par tournée.`);
  if (typeof livreurId !== "string" || !livreurId) throw new UserError("Choisissez le livreur de la tournée.");

  const [livreur, deliveries] = await Promise.all([
    prisma.livreur.findUnique({ where: { id: livreurId }, select: { id: true } }),
    prisma.delivery.findMany({
      where: { id: { in: deliveryIds } },
      select: { id: true, scheduledAt: true, runId: true, run: { select: { settledAt: true } }, order: { select: { status: true } } },
    }),
  ]);
  if (!livreur) throw new UserError("Livreur introuvable.");
  if (deliveries.length !== deliveryIds.length) throw new UserError("Certaines livraisons n'existent plus : rechargez la page.");
  if (deliveries.some((d) => d.run?.settledAt)) throw new UserError("Une des livraisons appartient à une tournée déjà réglée.");
  if (deliveries.some((d) => d.order.status === "ANNULEE")) throw new UserError("Une des commandes sélectionnées est annulée.");

  // Date de la tournée : jour de la première livraison prévue
  const date = new Date(Math.min(...deliveries.map((d) => d.scheduledAt.getTime())));
  date.setHours(0, 0, 0, 0);

  const previousRuns = [...new Set(deliveries.flatMap((d) => (d.runId ? [d.runId] : [])))];
  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.deliveryRun.create({ data: { livreurId, date } });
    await tx.delivery.updateMany({ where: { id: { in: deliveryIds } }, data: { runId: created.id, livreurId } });
    return created;
  });

  for (const previous of previousRuns) await recomputeRun(prisma, previous);
  await recomputeRun(prisma, run.id);
  revalidateRuns();
  return { id: run.id };
}

/** Mode de rémunération (calculé ou forfait) et note de la tournée. */
async function updateRunImpl(runId: string, formData: FormData) {
  await requireAdmin();
  await unsettledRun(runId);

  const costMode = formData.get("costMode") === "FORFAIT" ? "FORFAIT" : "CALCULE";
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 500) || null;
  const cost = costMode === "FORFAIT" ? toInt(formData.get("cost"), "Montant du forfait", { max: 10_000_000 }) : undefined;

  await prisma.deliveryRun.update({ where: { id: runId }, data: { costMode, notes, cost } });
  await recomputeRun(prisma, runId); // en mode calculé, remet le montant sur l'estimation
  revalidateRuns(runId);
}

/** Recalcule l'estimation (après avoir placé la boutique, changé les tarifs…). */
async function recalculateRunImpl(runId: string) {
  await requireAdmin();
  await unsettledRun(runId);
  await recomputeRun(prisma, runId);
  revalidateRuns(runId);
}

/** Retire une livraison de sa tournée (elle garde son livreur). Renvoie false si la tournée, vide, a été supprimée. */
async function removeFromRunImpl(deliveryId: string) {
  await requireAdmin();
  const delivery = await prisma.delivery.findUnique({ where: { id: deliveryId }, select: { runId: true } });
  if (!delivery?.runId) return { runExists: false };
  await unsettledRun(delivery.runId);

  await prisma.delivery.update({ where: { id: deliveryId }, data: { runId: null } });
  const runExists = await recomputeRun(prisma, delivery.runId);
  revalidateRuns(delivery.runId);
  return { runExists };
}

/** Supprime une tournée non réglée : les livraisons restent, sans tournée. */
async function deleteRunImpl(runId: string) {
  await requireAdmin();
  await unsettledRun(runId);
  await prisma.$transaction([
    prisma.delivery.updateMany({ where: { runId }, data: { runId: null } }),
    prisma.deliveryRun.delete({ where: { id: runId } }),
  ]);
  revalidateRuns();
}

/**
 * Règlement : le livreur a remis les encaissements, sa paie déduite.
 * Refusé tant qu'un arrêt n'est ni livré ni échoué (le retirer de la tournée sinon).
 */
async function settleRunImpl(runId: string, settled: boolean) {
  await requireAdmin();
  const run = await prisma.deliveryRun.findUnique({
    where: { id: runId },
    include: { deliveries: { select: { status: true, deliveryFee: true, order: { select: { finalTotal: true, depositAmount: true } } } } },
  });
  if (!run) throw new UserError("Tournée introuvable.");

  if (settled) {
    const { pending } = runSettlement(
      run.deliveries.map((d) => ({ status: d.status, deliveryFee: d.deliveryFee, ...d.order })),
      run.cost,
    );
    if (pending > 0) {
      throw new UserError(`${pending} arrêt(s) pas encore livré(s) ou échoué(s) : mettez à jour leur statut ou retirez-les de la tournée.`);
    }
  }

  await prisma.deliveryRun.update({
    where: { id: runId },
    data: settled ? { settledAt: new Date(), status: "TERMINEE" } : { settledAt: null, status: "PLANIFIEE" },
  });
  revalidateRuns(runId);
}

export const createRun = withActionResult(createRunImpl);
export const updateRun = withActionResult(updateRunImpl);
export const recalculateRun = withActionResult(recalculateRunImpl);
export const removeFromRun = withActionResult(removeFromRunImpl);
export const deleteRun = withActionResult(deleteRunImpl);
export const settleRun = withActionResult(settleRunImpl);
