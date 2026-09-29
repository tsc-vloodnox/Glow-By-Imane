"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { unwrapAction } from "@/lib/action-result";
import { mapsUrl, runCost, type RunCostSettings } from "@/lib/delivery";
import { DeliveryMap, type MapPoint } from "../../_components/DeliveryMap";
import {
  createQuartier as createQuartierAction,
  movePickupPoint as movePickupPointAction,
  moveQuartier as moveQuartierAction,
  suggestQuartierFees as suggestQuartierFeesAction,
  updateDeliverySettings as updateDeliverySettingsAction,
  updatePickupPoint as updatePickupPointAction,
  updateQuartier as updateQuartierAction,
} from "./actions";

// Actions serveur : lèvent une Error au message lisible en cas d'échec (cf. lib/action-result.ts)
const createQuartier = unwrapAction(createQuartierAction);
const movePickupPoint = unwrapAction(movePickupPointAction);
const moveQuartier = unwrapAction(moveQuartierAction);
const suggestQuartierFees = unwrapAction(suggestQuartierFeesAction);
const updateDeliverySettings = unwrapAction(updateDeliverySettingsAction);
const updatePickupPoint = unwrapAction(updatePickupPointAction);
const updateQuartier = unwrapAction(updateQuartierAction);

type Pickup = { id: string; name: string; address: string | null; lat: number | null; lng: number | null };
type Quartier = { id: string; name: string; commune: string; lat: number; lng: number; feeMin: number | null; feeMax: number | null; active: boolean };

const card = "rounded-xl border border-[var(--color-border)] bg-white p-4";
const input = "rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-sm";

export function DeliverySettingsClient({ pickupPoint, quartiers, settings }: { pickupPoint: Pickup; quartiers: Quartier[]; settings: RunCostSettings }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [placing, setPlacing] = useState<null | "shop" | { name: string; commune: string }>(pickupPoint.lat == null ? "shop" : null);
  const [drafts, setDrafts] = useState<Record<string, { feeMin: string; feeMax: string; active: boolean }>>({});
  const [newQuartier, setNewQuartier] = useState({ name: "", commune: "" });
  const [example, setExample] = useState(settings);

  function run(action: () => Promise<unknown>, success?: string) {
    setMessage(null);
    startTransition(async () => {
      try {
        await action();
        if (success) setMessage({ tone: "ok", text: success });
        router.refresh();
      } catch (err) {
        setMessage({ tone: "error", text: err instanceof Error ? err.message : "Erreur." });
      }
    });
  }

  const points = useMemo<MapPoint[]>(() => {
    const list: MapPoint[] = quartiers.map((q) => ({
      id: q.id, label: `${q.name} (${q.commune})`, lat: q.lat, lng: q.lng, kind: "quartier", draggable: true, muted: !q.active,
    }));
    if (pickupPoint.lat != null && pickupPoint.lng != null) {
      list.push({ id: pickupPoint.id, label: pickupPoint.name, lat: pickupPoint.lat, lng: pickupPoint.lng, kind: "shop", draggable: true });
    }
    return list;
  }, [quartiers, pickupPoint]);

  function handleMove(id: string, lat: number, lng: number) {
    run(() => (id === pickupPoint.id ? movePickupPoint(id, lat, lng) : moveQuartier(id, lat, lng)), "Position enregistrée.");
  }

  function handleMapClick(lat: number, lng: number) {
    if (placing === "shop") {
      run(() => movePickupPoint(pickupPoint.id, lat, lng), "Boutique placée.");
      setPlacing(null);
    } else if (placing) {
      const toCreate = placing;
      run(() => createQuartier({ ...toCreate, lat, lng }), `Quartier « ${toCreate.name} » ajouté.`);
      setPlacing(null);
      setNewQuartier({ name: "", commune: "" });
    }
  }

  const communes = [...new Set(quartiers.map((q) => q.commune))];
  const draftOf = (q: Quartier) => drafts[q.id] ?? { feeMin: q.feeMin?.toString() ?? "", feeMax: q.feeMax?.toString() ?? "", active: q.active };
  const isDirty = (q: Quartier) => {
    const d = draftOf(q);
    return d.feeMin !== (q.feeMin?.toString() ?? "") || d.feeMax !== (q.feeMax?.toString() ?? "") || d.active !== q.active;
  };
  const missingFees = quartiers.filter((q) => q.active && q.feeMin == null && q.feeMax == null).length;

  return (
    <div className="space-y-4">
      {message ? (
        <p className={`rounded-lg p-2.5 text-sm ${message.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{message.text}</p>
      ) : null}

      {/* Carte */}
      <section className={card}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">Carte</h2>
          {placing ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
              👆 Touchez la carte pour placer {placing === "shop" ? "la boutique" : `« ${placing.name} »`}
            </span>
          ) : (
            <button type="button" onClick={() => setPlacing("shop")} className="text-xs text-[var(--color-accent)] underline">
              Replacer la boutique
            </button>
          )}
        </div>
        <DeliveryMap points={points} onMove={handleMove} onMapClick={handleMapClick} className="h-96 w-full rounded-lg border border-[var(--color-border)]" />
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          Déplacez un point pour corriger sa position. Les positions des quartiers sont approximatives au départ : ajustez-les une fois, elles servent au calcul des distances.
        </p>
      </section>

      {/* Point de départ */}
      <section className={card}>
        <h2 className="mb-2 font-medium">Point de départ (boutique)</h2>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            run(() => updatePickupPoint(pickupPoint.id, formData), "Point de départ enregistré.");
          }}
        >
          <label className="flex min-w-0 flex-1 basis-40 flex-col gap-1 text-xs text-[var(--color-muted)]">
            Nom
            <input name="name" defaultValue={pickupPoint.name} required maxLength={80} className={input} />
          </label>
          <label className="flex min-w-0 flex-1 basis-56 flex-col gap-1 text-xs text-[var(--color-muted)]">
            Adresse / repère (affiché aux clientes)
            <input name="address" defaultValue={pickupPoint.address ?? ""} maxLength={200} className={input} />
          </label>
          <button disabled={isPending} className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            Enregistrer
          </button>
        </form>
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          {pickupPoint.lat != null && pickupPoint.lng != null ? (
            <a href={mapsUrl({ lat: pickupPoint.lat, lng: pickupPoint.lng })} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] underline">
              📍 Lien Google Maps affiché aux clientes
            </a>
          ) : (
            "⚠️ Position non placée : touchez la carte pour placer la boutique (lien carte et calculs de distance désactivés d'ici là)."
          )}
        </p>
      </section>

      {/* Quartiers */}
      <section className={card}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-medium">Quartiers et fourchettes clientes</h2>
            <p className="text-xs text-[var(--color-muted)]">
              Affichées au paiement à titre indicatif. Min = max pour un prix fixe. {missingFees > 0 ? `${missingFees} quartier(s) sans fourchette (« à confirmer »).` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={isPending} onClick={() => run(async () => {
              const n = await suggestQuartierFees(false);
              setMessage({ tone: "ok", text: `${n} fourchette(s) suggérée(s) selon la distance à la boutique.` });
            })} className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs disabled:opacity-60">
              Suggérer les vides
            </button>
            <button type="button" disabled={isPending} onClick={() => {
              if (window.confirm("Recalculer TOUTES les fourchettes selon la distance ? Vos valeurs actuelles seront remplacées.")) {
                run(async () => {
                  const n = await suggestQuartierFees(true);
                  setMessage({ tone: "ok", text: `${n} fourchette(s) recalculée(s).` });
                });
              }
            }} className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] disabled:opacity-60">
              Tout recalculer
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {communes.map((commune) => (
            <div key={commune}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{commune}</h3>
              <ul className="divide-y divide-[var(--color-border)]">
                {quartiers.filter((q) => q.commune === commune).map((q) => {
                  const d = draftOf(q);
                  const set = (patch: Partial<typeof d>) => setDrafts((prev) => ({ ...prev, [q.id]: { ...d, ...patch } }));
                  return (
                    <li key={q.id} className="flex flex-wrap items-center gap-2 py-2">
                      <span className={`min-w-0 flex-1 basis-28 text-sm ${q.active ? "" : "text-[var(--color-muted)] line-through"}`}>{q.name}</span>
                      <input type="number" inputMode="numeric" min={0} placeholder="min" value={d.feeMin}
                        aria-label={`Frais minimum ${q.name}`} onChange={(e) => set({ feeMin: e.target.value })} className={`${input} w-24 text-right`} />
                      <span className="text-xs text-[var(--color-muted)]">–</span>
                      <input type="number" inputMode="numeric" min={0} placeholder="max" value={d.feeMax}
                        aria-label={`Frais maximum ${q.name}`} onChange={(e) => set({ feeMax: e.target.value })} className={`${input} w-24 text-right`} />
                      <label className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
                        <input type="checkbox" checked={d.active} onChange={(e) => set({ active: e.target.checked })} /> actif
                      </label>
                      <button type="button" disabled={!isDirty(q) || isPending}
                        onClick={() => run(async () => {
                          await updateQuartier(q.id, d);
                          setDrafts((prev) => { const next = { ...prev }; delete next[q.id]; return next; });
                        }, `${q.name} enregistré.`)}
                        className="rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-medium text-white disabled:opacity-30">
                        OK
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <form
          className="mt-4 flex flex-wrap items-end gap-2 border-t border-[var(--color-border)] pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (newQuartier.name.trim() && newQuartier.commune.trim()) setPlacing({ name: newQuartier.name.trim(), commune: newQuartier.commune.trim() });
          }}
        >
          <input value={newQuartier.name} onChange={(e) => setNewQuartier({ ...newQuartier, name: e.target.value })}
            placeholder="Nouveau quartier" maxLength={60} className={`${input} min-w-0 flex-1 basis-36`} />
          <input value={newQuartier.commune} onChange={(e) => setNewQuartier({ ...newQuartier, commune: e.target.value })}
            placeholder="Commune" maxLength={60} list="communes" className={`${input} min-w-0 flex-1 basis-28`} />
          <datalist id="communes">{communes.map((c) => <option key={c} value={c} />)}</datalist>
          <button className="rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs">Ajouter puis placer sur la carte</button>
        </form>
      </section>

      {/* Tarifs des tournées */}
      <section className={card}>
        <h2 className="font-medium">Paie des livreurs : tarif des tournées</h2>
        <p className="mb-3 text-xs text-[var(--color-muted)]">
          Coût d&apos;une tournée = prise en charge + km estimés × prix au km + supplément par arrêt à partir du 2e. Deux clientes voisines n&apos;ajoutent que le supplément. Un forfait peut toujours être saisi à la main sur une tournée.
        </p>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onChange={(e) => {
            const f = new FormData(e.currentTarget);
            setExample({
              baseFee: Number(f.get("baseFee")) || 0,
              perKm: Number(f.get("perKm")) || 0,
              perExtraStop: Number(f.get("perExtraStop")) || 0,
              includeReturn: f.get("includeReturn") === "on",
              roadFactor: Number(String(f.get("roadFactor")).replace(",", ".")) || 1,
            });
          }}
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.currentTarget);
            run(() => updateDeliverySettings(formData), "Tarifs enregistrés.");
          }}
        >
          {[
            ["baseFee", "Prise en charge (GNF)", settings.baseFee],
            ["perKm", "Prix au km (GNF)", settings.perKm],
            ["perExtraStop", "Supplément par arrêt dès le 2e (GNF)", settings.perExtraStop],
          ].map(([name, label, value]) => (
            <label key={name as string} className="flex flex-col gap-1 text-xs text-[var(--color-muted)]">
              {label}
              <input name={name as string} type="number" inputMode="numeric" min={0} defaultValue={value as number} required className={input} />
            </label>
          ))}
          <label className="flex flex-col gap-1 text-xs text-[var(--color-muted)]">
            Facteur route (vol d&apos;oiseau → route)
            <input name="roadFactor" type="number" step="0.05" min={1} max={2} defaultValue={settings.roadFactor} required className={input} />
          </label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="includeReturn" defaultChecked={settings.includeReturn} /> Compter le retour à la boutique
          </label>
          <p className="rounded-lg bg-[var(--color-sand)] p-2.5 text-xs sm:col-span-2">
            Exemple : 3 clientes voisines à 10 km →{" "}
            <strong>{runCost(example, 10 * example.roadFactor * (example.includeReturn ? 2 : 1), 3).toLocaleString("fr-GN")} GNF</strong>{" "}
            la tournée, au lieu de {(3 * runCost(example, 10 * example.roadFactor * (example.includeReturn ? 2 : 1), 1)).toLocaleString("fr-GN")} GNF pour trois courses séparées.
          </p>
          <button disabled={isPending} className="w-fit rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            Enregistrer les tarifs
          </button>
        </form>
      </section>
    </div>
  );
}
