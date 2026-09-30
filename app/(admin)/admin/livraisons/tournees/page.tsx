import Link from "next/link";

import { runSettlement } from "@/lib/delivery";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../../actions";

const gnf = (value: number) => `${value.toLocaleString("fr-GN")} GNF`;

export default async function RunsPage() {
  await requireAdmin();

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const runs = await prisma.deliveryRun.findMany({
    where: { OR: [{ settledAt: null }, { settledAt: { gte: since } }] },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    include: {
      livreur: { select: { id: true, name: true } },
      deliveries: { select: { status: true, deliveryFee: true, order: { select: { finalTotal: true, depositAmount: true } } } },
    },
  });

  const rows = runs.map((run) => ({
    run,
    settlement: runSettlement(
      run.deliveries.map((d) => ({ status: d.status, deliveryFee: d.deliveryFee, ...d.order })),
      run.cost,
    ),
  }));

  // Soldes à régler par livreur (tournées non réglées)
  const owed = new Map<string, { name: string; runs: number; cost: number; toRemit: number }>();
  for (const { run, settlement } of rows) {
    if (run.settledAt) continue;
    const entry = owed.get(run.livreur.id) ?? { name: run.livreur.name, runs: 0, cost: 0, toRemit: 0 };
    entry.runs += 1;
    entry.cost += settlement.cost;
    entry.toRemit += settlement.toRemit;
    owed.set(run.livreur.id, entry);
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/livraisons" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]">
          ← Livraisons
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Tournées</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Un déplacement du livreur = une tournée, payée une fois (prise en charge + km + petit supplément par arrêt).
          Pour en créer une : sélectionnez des livraisons dans la vue Livraisons.
        </p>
      </div>

      {owed.size > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          {[...owed.values()].map((entry) => (
            <div key={entry.name} className="rounded-xl border border-[var(--color-border)] bg-white p-4 text-sm">
              <p className="font-semibold">🛵 {entry.name}</p>
              <p className="text-xs text-[var(--color-muted)]">{entry.runs} tournée(s) non réglée(s)</p>
              <p className="mt-2">Rémunération due : <strong>{gnf(entry.cost)}</strong></p>
              <p>À remettre à la boutique : <strong>{gnf(entry.toRemit)}</strong></p>
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 text-sm text-[var(--color-muted)]">
          Aucune tournée.{" "}
          <Link href="/admin/livraisons" className="text-[var(--color-accent)] hover:underline">
            Regrouper des livraisons →
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border)] overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
          {rows.map(({ run, settlement }) => (
            <li key={run.id}>
              <Link href={`/admin/livraisons/tournees/${run.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-[var(--color-sand)]">
                <span className="text-sm font-medium capitalize">
                  {run.date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}
                </span>
                <span className="text-sm">🛵 {run.livreur.name}</span>
                <span className="text-xs text-[var(--color-muted)]">
                  {run.deliveries.length} arrêt(s){run.estimatedKm != null && ` · ≈ ${run.estimatedKm.toLocaleString("fr-FR")} km`}
                  {run.costMode === "FORFAIT" && " · forfait"}
                </span>
                <span className="ml-auto text-sm">{gnf(settlement.cost)}</span>
                {run.settledAt ? (
                  <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700">Réglée</span>
                ) : settlement.pending > 0 ? (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                    {settlement.pending} en attente
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">À régler</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
