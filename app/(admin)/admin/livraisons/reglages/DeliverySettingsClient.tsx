"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { unwrapAction } from "@/lib/action-result";
import { formatFeeRange, mapsUrl, runCost, type RunCostSettings } from "@/lib/delivery";
import { DeliveryMap, type MapPoint } from "../../_components/DeliveryMap";
import {
  deleteQuartier as deleteQuartierAction,
  movePickupPoint as movePickupPointAction,
  moveQuartier as moveQuartierAction,
  renameCommune as renameCommuneAction,
  saveQuartier as saveQuartierAction,
  setCommuneFees as setCommuneFeesAction,
  suggestQuartierFees as suggestQuartierFeesAction,
  updateDeliverySettings as updateDeliverySettingsAction,
  updatePickupPoint as updatePickupPointAction,
} from "./actions";

// Actions serveur : lèvent une Error au message lisible en cas d'échec (cf. lib/action-result.ts)
const deleteQuartier = unwrapAction(deleteQuartierAction);
const movePickupPoint = unwrapAction(movePickupPointAction);
const moveQuartier = unwrapAction(moveQuartierAction);
const renameCommune = unwrapAction(renameCommuneAction);
const saveQuartier = unwrapAction(saveQuartierAction);
const setCommuneFees = unwrapAction(setCommuneFeesAction);
const suggestQuartierFees = unwrapAction(suggestQuartierFeesAction);
const updateDeliverySettings = unwrapAction(updateDeliverySettingsAction);
const updatePickupPoint = unwrapAction(updatePickupPointAction);

type Pickup = { id: string; name: string; address: string | null; lat: number | null; lng: number | null };
type Quartier = {
  id: string;
  name: string;
  commune: string;
  lat: number;
  lng: number;
  feeMin: number | null;
  feeMax: number | null;
  active: boolean;
  orderCount: number;
};
type Tab = "quartiers" | "boutique" | "tarifs";
/** Ce que le prochain clic sur la carte place : la boutique, ou la position du formulaire quartier ouvert */
type Placing = null | "shop" | "quartier";

const card = "rounded-xl border border-[var(--color-border)] bg-white p-4";
const input = "rounded-lg border border-[var(--color-border)] bg-white px-2 py-1.5 text-sm";
const labelClass = "flex min-w-0 flex-col gap-1 text-xs text-[var(--color-muted)]";
const primary = "rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50";
const secondary = "rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs disabled:opacity-50";

export function DeliverySettingsClient({ pickupPoint, quartiers, settings }: { pickupPoint: Pickup; quartiers: Quartier[]; settings: RunCostSettings }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<Tab>(pickupPoint.lat == null ? "boutique" : "quartiers");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [placing, setPlacing] = useState<Placing>(pickupPoint.lat == null ? "shop" : null);
  /** Quartier en cours d'édition : son id, "new" pour un ajout */
  const [editing, setEditing] = useState<string | null>(null);
  const [draftPosition, setDraftPosition] = useState<{ lat: string; lng: string }>({ lat: "", lng: "" });
  const [search, setSearch] = useState("");
  const [communeFilter, setCommuneFilter] = useState("");
  const [communeFeesFor, setCommuneFeesFor] = useState<string | null>(null);
  const [example, setExample] = useState(settings);

  function run(action: () => Promise<unknown>, success?: string | ((result: unknown) => string), after?: () => void) {
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await action();
        after?.();
        if (success) setMessage({ tone: "ok", text: typeof success === "function" ? success(result) : success });
        router.refresh();
      } catch (err) {
        setMessage({ tone: "error", text: err instanceof Error ? err.message : "Erreur." });
      }
    });
  }

  const communes = useMemo(() => [...new Set(quartiers.map((q) => q.commune))], [quartiers]);
  const editedQuartier = editing && editing !== "new" ? quartiers.find((q) => q.id === editing) ?? null : null;

  function openEditor(id: string | null) {
    setTab("quartiers");
    setPlacing(null);
    if (!id) {
      setEditing(null);
      return;
    }
    const q = quartiers.find((x) => x.id === id);
    setEditing(id);
    setDraftPosition(q ? { lat: String(q.lat), lng: String(q.lng) } : { lat: "", lng: "" });
  }

  const points = useMemo<MapPoint[]>(() => {
    const list: MapPoint[] = quartiers.map((q) => ({
      id: q.id,
      label: `${q.name} (${q.commune})${formatFeeRange(q.feeMin, q.feeMax) ? ` · ${formatFeeRange(q.feeMin, q.feeMax)}` : ""}`,
      lat: q.id === editing && draftPosition.lat ? Number(draftPosition.lat) : q.lat,
      lng: q.id === editing && draftPosition.lng ? Number(draftPosition.lng) : q.lng,
      kind: "quartier",
      draggable: true,
      muted: !q.active,
    }));
    if (editing === "new" && draftPosition.lat && draftPosition.lng) {
      list.push({ id: "new", label: "Nouveau quartier", lat: Number(draftPosition.lat), lng: Number(draftPosition.lng), kind: "stop", badge: "+" });
    }
    if (pickupPoint.lat != null && pickupPoint.lng != null) {
      list.push({ id: pickupPoint.id, label: pickupPoint.name, lat: pickupPoint.lat, lng: pickupPoint.lng, kind: "shop", draggable: true });
    }
    return list;
  }, [quartiers, pickupPoint, editing, draftPosition]);

  function handleMove(id: string, lat: number, lng: number) {
    if (id === pickupPoint.id) run(() => movePickupPoint(id, lat, lng), "Boutique déplacée.");
    else if (id === editing || id === "new") setDraftPosition({ lat: String(lat), lng: String(lng) });
    else run(() => moveQuartier(id, lat, lng), "Position enregistrée.");
  }

  function handleMapClick(lat: number, lng: number) {
    if (placing === "shop") {
      run(() => movePickupPoint(pickupPoint.id, lat, lng), "Boutique placée.");
      setPlacing(null);
    } else if (placing === "quartier") {
      setDraftPosition({ lat: String(lat), lng: String(lng) });
      setPlacing(null);
    }
  }

  const needle = search.trim().toLowerCase();
  const visible = quartiers.filter(
    (q) => (!communeFilter || q.commune === communeFilter) && (!needle || q.name.toLowerCase().includes(needle)),
  );
  const missingFees = quartiers.filter((q) => q.active && q.feeMin == null && q.feeMax == null).length;

  /** Formulaire d'ajout / modification d'un quartier */
  function quartierEditor(q: Quartier | null) {
    return (
      <form
        key={q?.id ?? "new"}
        className="space-y-3 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-sand)] p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          run(() => saveQuartier(q?.id ?? null, formData), q ? "Quartier enregistré." : "Quartier ajouté.", () => setEditing(null));
        }}
      >
        <p className="text-sm font-medium">{q ? `Modifier « ${q.name} »` : "Nouveau quartier"}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className={labelClass}>
            Nom
            <input name="name" defaultValue={q?.name ?? ""} required maxLength={60} className={input} />
          </label>
          <label className={labelClass}>
            Commune / zone
            <input name="commune" defaultValue={q?.commune ?? communeFilter} required maxLength={60} list="communes" className={input} />
          </label>
          <label className={labelClass}>
            Frais minimum (GNF)
            <input name="feeMin" type="number" inputMode="numeric" min={0} step={500} defaultValue={q?.feeMin ?? ""} className={input} />
          </label>
          <label className={labelClass}>
            Frais maximum (GNF)
            <input name="feeMax" type="number" inputMode="numeric" min={0} step={500} defaultValue={q?.feeMax ?? ""} className={input} />
          </label>
          <label className={labelClass}>
            Latitude
            <input name="lat" type="number" step="0.00001" value={draftPosition.lat}
              onChange={(e) => setDraftPosition((p) => ({ ...p, lat: e.target.value }))} className={input} />
          </label>
          <label className={labelClass}>
            Longitude
            <input name="lng" type="number" step="0.00001" value={draftPosition.lng}
              onChange={(e) => setDraftPosition((p) => ({ ...p, lng: e.target.value }))} className={input} />
          </label>
        </div>
        <p className="text-xs text-[var(--color-muted)]">
          Fourchette vide = « à confirmer » ; un seul montant = prix fixe.{" "}
          {q ? "Déplacez le point sur la carte ou" : "Position vide = centre de la commune (à ajuster) ;"}{" "}
          <button type="button" onClick={() => setPlacing("quartier")} className="text-[var(--color-accent)] underline">
            {placing === "quartier" ? "touchez la carte…" : "choisir sur la carte"}
          </button>
          .
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" defaultChecked={q?.active ?? true} /> Proposé aux clientes
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button disabled={isPending} className={primary}>{q ? "Enregistrer" : "Ajouter"}</button>
          <button type="button" onClick={() => { setEditing(null); setPlacing(null); }} className="text-sm text-[var(--color-muted)]">
            Annuler
          </button>
          {q && (
            <button
              type="button"
              disabled={isPending || q.orderCount > 0}
              title={q.orderCount > 0 ? `Utilisé par ${q.orderCount} commande(s) : décochez « Proposé aux clientes » pour le retirer` : undefined}
              onClick={() => {
                if (window.confirm(`Supprimer définitivement « ${q.name} » ?`)) run(() => deleteQuartier(q.id), "Quartier supprimé.", () => setEditing(null));
              }}
              className="ml-auto text-sm text-red-600 disabled:text-[var(--color-muted)] disabled:opacity-60"
            >
              Supprimer
            </button>
          )}
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      {/* Onglets */}
      <div className="flex gap-1 overflow-x-auto rounded-full border border-[var(--color-border)] bg-white p-1 text-sm">
        {([
          ["quartiers", `Quartiers (${quartiers.length})`],
          ["boutique", "Boutique"],
          ["tarifs", "Paie des livreurs"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 whitespace-nowrap rounded-full px-3 py-1.5 ${tab === key ? "bg-[var(--color-accent)] font-medium text-white" : "text-[var(--color-muted)]"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {message && (
        <p className={`rounded-lg p-2.5 text-sm ${message.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{message.text}</p>
      )}

      {/* Carte (quartiers et boutique) */}
      {tab !== "tarifs" && (
        <section className={card}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">Carte</h2>
            {placing ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                👆 Touchez la carte pour placer {placing === "shop" ? "la boutique" : "le quartier"}
              </span>
            ) : (
              <span className="text-xs text-[var(--color-muted)]">Touchez un point pour le modifier, faites-le glisser pour le déplacer.</span>
            )}
          </div>
          <DeliveryMap
            points={points}
            onMove={handleMove}
            onPointClick={(id) => (id === pickupPoint.id ? setTab("boutique") : id !== "new" && openEditor(id))}
            onMapClick={handleMapClick}
            className="h-80 w-full rounded-lg border border-[var(--color-border)] sm:h-96"
          />
        </section>
      )}

      {tab === "quartiers" && (
        <section className={card}>
          <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-medium">Quartiers et fourchettes clientes</h2>
              <p className="text-xs text-[var(--color-muted)]">
                Affichées au paiement à titre indicatif.
                {missingFees > 0 && ` ${missingFees} quartier(s) actif(s) sans fourchette (« à confirmer »).`}
              </p>
            </div>
            <button type="button" onClick={() => { setEditing("new"); setDraftPosition({ lat: "", lng: "" }); }} className={primary}>
              + Nouveau quartier
            </button>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher…" className={`${input} min-w-0 flex-1 basis-32`} />
            <select value={communeFilter} onChange={(e) => setCommuneFilter(e.target.value)} className={input} aria-label="Commune">
              <option value="">Toutes les communes</option>
              {communes.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="button" disabled={isPending} className={secondary}
              onClick={() => run(() => suggestQuartierFees(false), (n) => `${n} fourchette(s) suggérée(s) selon la distance à la boutique.`)}>
              Suggérer les vides
            </button>
            <button type="button" disabled={isPending} className={`${secondary} text-[var(--color-muted)]`}
              onClick={() => {
                if (window.confirm("Recalculer TOUTES les fourchettes selon la distance ? Vos valeurs actuelles seront remplacées.")) {
                  run(() => suggestQuartierFees(true), (n) => `${n} fourchette(s) recalculée(s).`);
                }
              }}>
              Tout recalculer
            </button>
          </div>
          <datalist id="communes">{communes.map((c) => <option key={c} value={c} />)}</datalist>

          {editing === "new" && <div className="mb-4">{quartierEditor(null)}</div>}

          <div className="space-y-4">
            {communes
              .filter((c) => visible.some((q) => q.commune === c))
              .map((commune) => (
                <div key={commune}>
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">{commune}</h3>
                    <button type="button" onClick={() => setCommuneFeesFor(communeFeesFor === commune ? null : commune)} className="text-xs text-[var(--color-accent)] underline">
                      Tarif de la commune
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const to = window.prompt(`Nouveau nom pour « ${commune} »`, commune);
                        if (to && to.trim() && to.trim() !== commune) run(() => renameCommune(commune, to), "Commune renommée.");
                      }}
                      className="text-xs text-[var(--color-muted)] underline"
                    >
                      Renommer
                    </button>
                  </div>

                  {communeFeesFor === commune && (
                    <form
                      className="mb-2 flex flex-wrap items-end gap-2 rounded-lg bg-[var(--color-sand)] p-2.5"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        run(() => setCommuneFees(commune, formData), (n) => `Fourchette appliquée à ${n} quartier(s) de ${commune}.`, () => setCommuneFeesFor(null));
                      }}
                    >
                      <label className={labelClass}>Min<input name="feeMin" type="number" min={0} step={500} className={`${input} w-28`} /></label>
                      <label className={labelClass}>Max<input name="feeMax" type="number" min={0} step={500} className={`${input} w-28`} /></label>
                      <label className="flex items-center gap-1 pb-2 text-xs"><input type="checkbox" name="onlyEmpty" defaultChecked /> seulement les quartiers sans fourchette</label>
                      <button disabled={isPending} className={secondary}>Appliquer</button>
                    </form>
                  )}

                  <ul className="divide-y divide-[var(--color-border)]">
                    {visible.filter((q) => q.commune === commune).map((q) =>
                      editing === q.id ? (
                        <li key={q.id} className="py-2">{quartierEditor(editedQuartier)}</li>
                      ) : (
                        <li key={q.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                          <span className={`min-w-0 flex-1 basis-28 text-sm ${q.active ? "" : "text-[var(--color-muted)] line-through"}`}>{q.name}</span>
                          <span className={`text-sm ${formatFeeRange(q.feeMin, q.feeMax) ? "" : "text-amber-600"}`}>
                            {formatFeeRange(q.feeMin, q.feeMax) ?? "à confirmer"}
                          </span>
                          <span className="w-20 text-right text-xs text-[var(--color-muted)]">
                            {q.orderCount} cmd{q.orderCount > 1 ? "s" : ""}
                          </span>
                          <button type="button" onClick={() => openEditor(q.id)} className="text-xs text-[var(--color-accent)] underline">
                            Modifier
                          </button>
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ))}
            {visible.length === 0 && <p className="text-sm text-[var(--color-muted)]">Aucun quartier ne correspond.</p>}
          </div>
        </section>
      )}

      {tab === "boutique" && (
        <section className={card}>
          <h2 className="mb-1 font-medium">Boutique : départ des livraisons et point de retrait</h2>
          <p className="mb-3 text-xs text-[var(--color-muted)]">Affichée aux clientes qui choisissent le retrait, avec un lien Google Maps.</p>
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              run(() => updatePickupPoint(pickupPoint.id, formData), "Boutique enregistrée.");
            }}
          >
            <label className={`${labelClass} flex-1 basis-40`}>
              Nom
              <input name="name" defaultValue={pickupPoint.name} required maxLength={80} className={input} />
            </label>
            <label className={`${labelClass} flex-1 basis-56`}>
              Adresse / repère
              <input name="address" defaultValue={pickupPoint.address ?? ""} maxLength={200} className={input} />
            </label>
            <button disabled={isPending} className={primary}>Enregistrer</button>
          </form>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            {pickupPoint.lat != null && pickupPoint.lng != null ? (
              <a href={mapsUrl({ lat: pickupPoint.lat, lng: pickupPoint.lng })} target="_blank" rel="noopener noreferrer" className="text-[var(--color-accent)] underline">
                📍 Voir le lien Google Maps
              </a>
            ) : (
              <span className="text-amber-700">⚠️ Position non placée : lien carte et calcul des distances désactivés.</span>
            )}
            <button type="button" onClick={() => setPlacing("shop")} className={secondary}>
              {pickupPoint.lat == null ? "Placer sur la carte" : "Replacer sur la carte"}
            </button>
          </div>
        </section>
      )}

      {tab === "tarifs" && (
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
            {([
              ["baseFee", "Prise en charge (GNF)", settings.baseFee],
              ["perKm", "Prix au km (GNF)", settings.perKm],
              ["perExtraStop", "Supplément par arrêt dès le 2e (GNF)", settings.perExtraStop],
            ] as const).map(([name, label, value]) => (
              <label key={name} className={labelClass}>
                {label}
                <input name={name} type="number" inputMode="numeric" min={0} defaultValue={value} required className={input} />
              </label>
            ))}
            <label className={labelClass}>
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
            <button disabled={isPending} className={`${primary} w-fit`}>Enregistrer les tarifs</button>
          </form>
        </section>
      )}
    </div>
  );
}
