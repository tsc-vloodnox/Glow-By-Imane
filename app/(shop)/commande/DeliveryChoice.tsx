"use client";

import Link from "next/link";
import { useState } from "react";

import { formatFeeRange, mapsUrl } from "@/lib/delivery";

export type QuartierOption = { id: string; name: string; commune: string; feeMin: number | null; feeMax: number | null };
export type PickupPointInfo = { name: string; address: string | null; lat: number | null; lng: number | null };

export type DeliveryValue = {
  mode: "LIVRAISON" | "RETRAIT";
  /** id d'un quartier de la liste, "autre" pour une saisie libre, "" si rien de choisi */
  quartierId: string;
  location: { lat: number; lng: number } | null;
};

export const OTHER_QUARTIER = "autre";

type Props = {
  quartiers: QuartierOption[];
  pickupPoint: PickupPointInfo | null;
  value: DeliveryValue;
  onChange: (value: DeliveryValue) => void;
};

/** Fourchette de frais du choix courant : texte affiché, ou null si à confirmer. */
export function feeLabelFor(value: DeliveryValue, quartiers: QuartierOption[]): string | null {
  if (value.mode === "RETRAIT") return "Gratuit (retrait)";
  const quartier = quartiers.find((q) => q.id === value.quartierId);
  return quartier ? formatFeeRange(quartier.feeMin, quartier.feeMax) : null;
}

export function DeliveryChoice({ quartiers, pickupPoint, value, onChange }: Props) {
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const pickupMapUrl =
    pickupPoint?.lat != null && pickupPoint.lng != null ? mapsUrl({ lat: pickupPoint.lat, lng: pickupPoint.lng }) : null;
  const communes = [...new Set(quartiers.map((q) => q.commune))];
  const selected = quartiers.find((q) => q.id === value.quartierId);
  const feeRange = selected ? formatFeeRange(selected.feeMin, selected.feeMax) : null;

  function shareLocation() {
    if (!("geolocation" in navigator)) {
      setLocationError("Votre navigateur ne permet pas de partager la position.");
      return;
    }
    setLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onChange({ ...value, location: { lat: position.coords.latitude, lng: position.coords.longitude } });
      },
      () => {
        setLocating(false);
        setLocationError("Position non partagée (autorisation refusée ou indisponible). Ce n'est pas obligatoire.");
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  }

  const modeButton = (mode: DeliveryValue["mode"], title: string, subtitle: string) => (
    <button
      type="button"
      onClick={() => onChange({ ...value, mode })}
      aria-pressed={value.mode === mode}
      className={`flex-1 rounded-xl border px-3 py-3 text-left ${
        value.mode === mode ? "border-[var(--color-accent)] bg-[var(--color-blush)]" : "border-[var(--color-border)] bg-white"
      }`}
    >
      <span className="block text-sm font-medium">{title}</span>
      <span className="block text-xs text-[var(--color-muted)]">{subtitle}</span>
    </button>
  );

  return (
    <fieldset className="space-y-3">
      <legend className="mb-1 text-sm font-medium">Livraison</legend>
      <div className="flex gap-2">
        {modeButton("LIVRAISON", "🛵 Livraison", "À régler à la réception")}
        {modeButton("RETRAIT", "🏬 Retrait en boutique", "Gratuit")}
      </div>

      {/* Point de départ figé : la cliente comprend d'où part sa livraison */}
      <label className="block space-y-1">
        <span className="text-xs text-[var(--color-muted)]">{value.mode === "RETRAIT" ? "Lieu de retrait" : "Départ de la livraison"}</span>
        <select disabled className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-sand)] px-4 py-3 text-sm">
          <option>{pickupPoint ? `${pickupPoint.name}${pickupPoint.address ? ` — ${pickupPoint.address}` : ""}` : "Boutique Glow by Imane"}</option>
        </select>
        {pickupMapUrl ? (
          <a href={pickupMapUrl} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-[var(--color-accent)] underline">
            📍 Voir la boutique sur la carte
          </a>
        ) : null}
      </label>

      {value.mode === "RETRAIT" ? (
        <p className="rounded-xl bg-[var(--color-blush)] p-3 text-sm text-[var(--color-muted)]">
          Nous vous confirmons sur WhatsApp quand votre commande est prête à être récupérée.
        </p>
      ) : (
        <>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Votre quartier</span>
            <select
              required
              value={value.quartierId}
              onChange={(e) => onChange({ ...value, quartierId: e.target.value })}
              className="w-full rounded-xl border border-[var(--color-border)] bg-white px-4 py-3"
            >
              <option value="" disabled>Choisissez votre quartier</option>
              {communes.map((commune) => (
                <optgroup key={commune} label={commune}>
                  {quartiers.filter((q) => q.commune === commune).map((q) => (
                    <option key={q.id} value={q.id}>{q.name}</option>
                  ))}
                </optgroup>
              ))}
              <option value={OTHER_QUARTIER}>Autre quartier…</option>
            </select>
          </label>

          {value.quartierId === OTHER_QUARTIER ? (
            <input name="quartier" required maxLength={120} placeholder="Votre quartier"
              className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3" />
          ) : value.quartierId ? (
            <input name="quartier" maxLength={120} placeholder="Précisions : rue, repère (facultatif)"
              className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3" />
          ) : null}

          {value.quartierId ? (
            <p className="rounded-xl bg-[var(--color-blush)] p-3 text-sm">
              {feeRange ? (
                <>
                  Frais de livraison estimés : <strong>{feeRange}</strong>
                  <span className="block text-xs text-[var(--color-muted)]">
                    À régler à la livraison. Le montant exact peut varier selon l&apos;adresse précise et vous est confirmé sur WhatsApp.
                  </span>
                </>
              ) : (
                <>Frais de livraison à confirmer sur WhatsApp selon votre adresse.</>
              )}
            </p>
          ) : null}

          <div className="rounded-xl border border-dashed border-[var(--color-border)] p-3">
            {value.location ? (
              <p className="flex items-center justify-between gap-2 text-sm">
                <span>📍 Position partagée ✓</span>
                <button type="button" onClick={() => onChange({ ...value, location: null })} className="text-xs text-[var(--color-muted)] underline">
                  Retirer
                </button>
              </p>
            ) : (
              <button type="button" onClick={shareLocation} disabled={locating}
                className="text-sm font-medium text-[var(--color-accent)] disabled:opacity-60">
                {locating ? "Localisation…" : "📍 Partager ma position (facultatif)"}
              </button>
            )}
            <p className="mt-1 text-xs text-[var(--color-muted)]">
              Aide le livreur à vous trouver. Utilisée uniquement pour cette livraison, visible seulement par la boutique.{" "}
              <Link href="/confidentialite" className="underline">En savoir plus</Link>
            </p>
            {locationError ? <p className="mt-1 text-xs text-amber-700">{locationError}</p> : null}
          </div>
        </>
      )}
    </fieldset>
  );
}
