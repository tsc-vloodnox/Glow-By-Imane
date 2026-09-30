"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { unwrapAction } from "@/lib/action-result";
import { expectedCollection, mapsUrl, runSettlement, type Point, type RunCostSettings } from "@/lib/delivery";
import { DELIVERY_STATUS_CONFIG, type DeliveryStatus } from "@/lib/order-status";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { DeliveryMap, type MapPoint } from "../../../_components/DeliveryMap";
import {
  updateDeliveryFee as updateDeliveryFeeAction,
  updateDeliveryStatus as updateDeliveryStatusAction,
} from "../../../actions";
import {
  deleteRun as deleteRunAction,
  recalculateRun as recalculateRunAction,
  removeFromRun as removeFromRunAction,
  settleRun as settleRunAction,
  updateRun as updateRunAction,
} from "../actions";

// Actions serveur : lèvent une Error au message lisible en cas d'échec (cf. lib/action-result.ts)
const deleteRun = unwrapAction(deleteRunAction);
const recalculateRun = unwrapAction(recalculateRunAction);
const removeFromRun = unwrapAction(removeFromRunAction);
const settleRun = unwrapAction(settleRunAction);
const updateRun = unwrapAction(updateRunAction);
const updateDeliveryFee = unwrapAction(updateDeliveryFeeAction);
const updateDeliveryStatus = unwrapAction(updateDeliveryStatusAction);

export type RunStop = {
  id: string;
  status: DeliveryStatus;
  deliveryFee: number;
  notes: string | null;
  scheduledAt: string;
  position: (Point & { precise: boolean }) | null;
  order: { id: string; number: number; name: string; phone: string; address: string; finalTotal: number; depositAmount: number };
};

type Props = {
  run: {
    id: string;
    costMode: "CALCULE" | "FORFAIT";
    cost: number;
    suggestedCost: number;
    estimatedKm: number | null;
    notes: string | null;
    settledAt: string | null;
    date: string;
  };
  livreur: { name: string; phone: string };
  start: (Point & { name: string }) | null;
  stops: RunStop[];
  missingPositions: number;
  settings: RunCostSettings;
};

const card = "rounded-xl border border-[var(--color-border)] bg-white p-4";
const gnf = (value: number) => `${value.toLocaleString("fr-GN")} GNF`;
/** Ce que la cliente doit remettre au livreur si tout se passe bien */
const dueOnDelivery = (stop: RunStop) => Math.max(stop.order.finalTotal - stop.order.depositAmount, 0) + stop.deliveryFee;

export function RunDetailClient({ run, livreur, start, stops, missingPositions, settings }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [costMode, setCostMode] = useState(run.costMode);
  const [fees, setFees] = useState<Record<string, string>>({});
  const settled = run.settledAt != null;

  function act(action: () => Promise<unknown>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        after?.();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  const settlement = runSettlement(
    stops.map((s) => ({ status: s.status, deliveryFee: s.deliveryFee, finalTotal: s.order.finalTotal, depositAmount: s.order.depositAmount })),
    run.cost,
  );

  const { points, route } = useMemo(() => {
    const located = stops.filter((s) => s.position);
    const list: MapPoint[] = located.map((s) => ({
      id: s.id,
      label: `${stops.indexOf(s) + 1}. #${s.order.number} ${s.order.name}${s.position!.precise ? "" : " (centre du quartier)"}`,
      lat: s.position!.lat,
      lng: s.position!.lng,
      kind: "stop",
      badge: String(stops.indexOf(s) + 1),
      muted: s.status === "LIVREE" || s.status === "ECHOUEE",
    }));
    const path = located.map((s) => ({ lat: s.position!.lat, lng: s.position!.lng }));
    if (start) {
      list.push({ id: "shop", label: start.name, lat: start.lat, lng: start.lng, kind: "shop" });
      path.unshift(start);
      if (settings.includeReturn && located.length > 0) path.push(start);
    }
    return { points: list, route: path };
  }, [stops, start, settings.includeReturn]);

  // Feuille de route envoyée au livreur sur WhatsApp, dans l'ordre de passage
  const roadmap = [
    `Tournée du ${new Date(run.date).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} — ${stops.length} arrêt(s)`,
    "",
    ...stops.map((s, i) =>
      [
        `${i + 1}. #${s.order.number} ${s.order.name} — ${s.order.phone}`,
        `   ${s.order.address}`,
        s.position ? `   ${mapsUrl(s.position)}${s.position.precise ? "" : " (quartier)"}` : null,
        `   À encaisser : ${gnf(dueOnDelivery(s))}`,
        s.notes ? `   Note : ${s.notes}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
    "",
    `Rémunération prévue : ${gnf(run.cost)}`,
  ].join("\n");

  return (
    <div className="space-y-4">
      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {settled && (
        <p className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          ✓ Réglée le {new Date(run.settledAt!).toLocaleDateString("fr-FR")}.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="min-w-0 space-y-4">
          <div className={card}>
            <DeliveryMap points={points} route={route} className="h-72 w-full rounded-lg" />
            <div className="mt-2 space-y-1 text-xs text-[var(--color-muted)]">
              {run.estimatedKm != null && <p>≈ {run.estimatedKm.toLocaleString("fr-FR")} km estimés{settings.includeReturn ? " (retour compris)" : ""}.</p>}
              {!start && (
                <p className="text-amber-700">
                  Boutique non placée sur la carte : distance non calculée.{" "}
                  <Link href="/admin/livraisons/reglages" className="underline">Placer la boutique</Link>
                </p>
              )}
              {missingPositions > 0 && (
                <p className="text-amber-700">
                  {missingPositions} arrêt(s) sans position (quartier saisi à la main) : estimation incomplète, passez au forfait si besoin.
                </p>
              )}
            </div>
          </div>

          <ol className="space-y-2">
            {stops.map((stop, index) => {
              const cfg = DELIVERY_STATUS_CONFIG[stop.status];
              const finished = stop.status === "LIVREE" || stop.status === "ECHOUEE";
              const feeDraft = fees[stop.id] ?? String(stop.deliveryFee);
              return (
                <li key={stop.id} className={`${card} min-w-0`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                      {index + 1}
                    </span>
                    <Link href={`/admin/commandes/${stop.order.id}`} className="text-sm font-medium hover:text-[var(--color-accent)]">
                      #{stop.order.number} — {stop.order.name}
                    </Link>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.color}`}>{cfg.label}</span>
                  </div>
                  <p className="mt-1 break-words text-xs text-[var(--color-muted)]">
                    {stop.order.address}
                    {stop.position && (
                      <>
                        {" · "}
                        <a href={mapsUrl(stop.position)} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] hover:underline">
                          {stop.position.precise ? "position partagée" : "centre du quartier"}
                        </a>
                      </>
                    )}
                    {stop.notes && ` · ${stop.notes}`}
                  </p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                    <span>
                      {finished ? "Encaissé attendu" : "À encaisser"} :{" "}
                      <strong>{gnf(finished ? expectedCollection({ ...stop, ...stop.order }) : dueOnDelivery(stop))}</strong>
                    </span>
                    <label className="flex items-center gap-1">
                      Frais
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={feeDraft}
                        disabled={settled}
                        onChange={(e) => setFees((prev) => ({ ...prev, [stop.id]: e.target.value }))}
                        onBlur={() => {
                          if (feeDraft !== String(stop.deliveryFee)) act(() => updateDeliveryFee(stop.id, Number(feeDraft)));
                        }}
                        className="w-20 rounded border border-[var(--color-border)] px-1.5 py-0.5"
                        title="0 = déplacement offert par la boutique"
                      />
                    </label>
                    {!settled && (
                      <div className="ml-auto flex flex-wrap gap-1.5">
                        {stop.status !== "LIVREE" && (
                          <button type="button" disabled={isPending} onClick={() => act(() => updateDeliveryStatus(stop.id, "LIVREE"))}
                            className="rounded-full bg-green-600 px-2.5 py-1 font-medium text-white disabled:opacity-50">
                            Livrée
                          </button>
                        )}
                        {stop.status !== "ECHOUEE" && stop.status !== "LIVREE" && (
                          <button type="button" disabled={isPending} onClick={() => act(() => updateDeliveryStatus(stop.id, "ECHOUEE"))}
                            className="rounded-full border border-red-200 px-2.5 py-1 text-red-700 disabled:opacity-50"
                            title="Le livreur s'est déplacé : les frais restent dus, sauf exemption (frais à 0)">
                            Échouée
                          </button>
                        )}
                        <button type="button" disabled={isPending}
                          onClick={() =>
                            act(async () => {
                              const { runExists } = await removeFromRun(stop.id);
                              if (!runExists) router.push("/admin/livraisons/tournees");
                            })
                          }
                          className="rounded-full px-2.5 py-1 text-[var(--color-muted)] hover:text-red-600 disabled:opacity-50">
                          Retirer
                        </button>
                      </div>
                    )}
                  </div>
                  {stop.status === "ECHOUEE" && stop.deliveryFee > 0 && (
                    <p className="mt-1 text-[11px] text-[var(--color-muted)]">
                      Déplacement dû par la cliente. Mettez les frais à 0 si la boutique l&apos;en exempte.
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="min-w-0 space-y-4">
          <div className={card}>
            <h2 className="font-semibold">🛵 {livreur.name}</h2>
            <a
              href={buildWhatsAppUrl(livreur.phone, roadmap)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 block rounded-full bg-green-600 px-4 py-2 text-center text-sm font-medium text-white hover:bg-green-700"
            >
              Envoyer la feuille de route
            </a>
          </div>

          <form
            key={`${run.costMode}-${run.cost}-${run.notes}`}
            className={`${card} space-y-3`}
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              act(() => updateRun(run.id, formData));
            }}
          >
            <h2 className="font-semibold">Rémunération du livreur</h2>
            <fieldset disabled={settled} className="space-y-2 text-sm">
              <label className="flex items-start gap-2">
                <input type="radio" name="costMode" value="CALCULE" checked={costMode === "CALCULE"} onChange={() => setCostMode("CALCULE")} className="mt-1" />
                <span>
                  Calculée : <strong>{gnf(run.suggestedCost)}</strong>
                  <span className="block text-xs text-[var(--color-muted)]">
                    {gnf(settings.baseFee)} de prise en charge
                    {run.estimatedKm != null && ` + ${run.estimatedKm.toLocaleString("fr-FR")} km × ${gnf(settings.perKm)}`}
                    {stops.length > 1 && ` + ${stops.length - 1} arrêt(s) × ${gnf(settings.perExtraStop)}`}
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input type="radio" name="costMode" value="FORFAIT" checked={costMode === "FORFAIT"} onChange={() => setCostMode("FORFAIT")} className="mt-1" />
                <span className="flex-1">
                  Forfait convenu pour le déplacement
                  {costMode === "FORFAIT" && (
                    <input name="cost" type="number" min="0" step="500" required defaultValue={run.cost}
                      className="mt-1 block w-full rounded-lg border border-[var(--color-border)] px-2 py-1.5" />
                  )}
                </span>
              </label>
              <textarea name="notes" defaultValue={run.notes ?? ""} rows={2} maxLength={500} placeholder="Note (facultatif)"
                className="w-full rounded-lg border border-[var(--color-border)] px-2 py-1.5" />
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={isPending} className="rounded-full bg-[var(--color-accent)] px-4 py-2 font-medium text-white disabled:opacity-50">
                  Enregistrer
                </button>
                <button type="button" disabled={isPending} onClick={() => act(() => recalculateRun(run.id))}
                  className="rounded-full border border-[var(--color-border)] px-4 py-2 disabled:opacity-50">
                  Recalculer
                </button>
              </div>
            </fieldset>
          </form>

          <div className={`${card} space-y-1.5 text-sm`}>
            <h2 className="mb-2 font-semibold">Règlement</h2>
            <Row label="Encaissé par le livreur" value={gnf(settlement.collected)} />
            <Row label="Sa rémunération" value={`− ${gnf(settlement.cost)}`} />
            {settlement.toRemit >= 0 ? (
              <Row label="À remettre à la boutique" value={gnf(settlement.toRemit)} strong />
            ) : (
              <Row label="La boutique doit au livreur" value={gnf(-settlement.toRemit)} strong />
            )}
            <p className="pt-2 text-xs text-[var(--color-muted)]">
              Frais de livraison payés par les clientes : {gnf(settlement.clientFees)} · solde livraison :{" "}
              <span className={settlement.deliveryBalance < 0 ? "text-red-600" : "text-green-700"}>
                {settlement.deliveryBalance >= 0 ? "+" : ""}
                {gnf(settlement.deliveryBalance)}
              </span>
            </p>
            {settlement.pending > 0 && (
              <p className="text-xs text-amber-700">{settlement.pending} arrêt(s) pas encore terminé(s) : non comptés.</p>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => act(() => settleRun(run.id, !settled))}
                className={settled
                  ? "rounded-full border border-[var(--color-border)] px-4 py-2 disabled:opacity-50"
                  : "rounded-full bg-green-600 px-4 py-2 font-medium text-white disabled:opacity-50"}
              >
                {settled ? "Annuler le règlement" : "Marquer réglée"}
              </button>
              {!settled && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    if (window.confirm("Supprimer cette tournée ? Les livraisons sont conservées."))
                      act(() => deleteRun(run.id), () => router.push("/admin/livraisons/tournees"));
                  }}
                  className="rounded-full px-4 py-2 text-[var(--color-muted)] hover:text-red-600 disabled:opacity-50"
                >
                  Supprimer
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-2 ${strong ? "border-t border-[var(--color-border)] pt-1.5 font-semibold" : ""}`}>
      <span>{label}</span>
      <span className="whitespace-nowrap">{value}</span>
    </div>
  );
}
