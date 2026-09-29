import Link from "next/link";
import { notFound } from "next/navigation";

import { estimateRun, getRunStart, runDeliveryInclude, stopPosition } from "@/lib/delivery-runs";
import { getDeliverySettings } from "@/lib/delivery-settings";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../../../actions";
import { RunDetailClient, type RunStop } from "./RunDetailClient";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;

  const [run, start, settings] = await Promise.all([
    prisma.deliveryRun.findUnique({
      where: { id },
      include: { livreur: { select: { name: true, phone: true } }, deliveries: { include: runDeliveryInclude } },
    }),
    getRunStart(),
    getDeliverySettings(),
  ]);
  if (!run) notFound();

  // Ordre de passage conseillé (recalculé à l'affichage, les positions ont pu changer)
  const estimate = estimateRun(run.deliveries, start, settings);
  const byId = new Map(run.deliveries.map((d) => [d.id, d]));
  const stops: RunStop[] = estimate.order.map((deliveryId) => {
    const d = byId.get(deliveryId)!;
    const position = stopPosition(d);
    return {
      id: d.id,
      status: d.status,
      deliveryFee: d.deliveryFee,
      notes: d.notes,
      scheduledAt: d.scheduledAt.toISOString(),
      position,
      order: {
        id: d.order.id,
        number: d.order.number,
        name: d.order.name,
        phone: d.order.phone,
        address: d.order.quartier,
        finalTotal: d.order.finalTotal,
        depositAmount: d.order.depositAmount,
      },
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/livraisons/tournees" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]">
          ← Tournées
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">
          Tournée de {run.livreur.name} —{" "}
          {run.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
        </h1>
      </div>
      <RunDetailClient
        run={{
          id: run.id,
          costMode: run.costMode,
          cost: run.cost,
          suggestedCost: run.suggestedCost,
          estimatedKm: run.estimatedKm,
          notes: run.notes,
          settledAt: run.settledAt?.toISOString() ?? null,
          date: run.date.toISOString(),
        }}
        livreur={run.livreur}
        start={start}
        stops={stops}
        missingPositions={estimate.missingPositions}
        settings={settings}
      />
    </div>
  );
}
