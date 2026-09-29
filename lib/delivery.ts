// Destination : lib/delivery.ts
// Calculs de livraison, sans API de cartographie : distances à vol d'oiseau (haversine)
// corrigées d'un facteur route, ordre de passage « plus proche d'abord », coût des tournées.

export type Point = { lat: number; lng: number };
export type Stop = Point & { id: string };

export type RunCostSettings = {
  baseFee: number;
  perKm: number;
  perExtraStop: number;
  includeReturn: boolean;
  roadFactor: number;
};

const EARTH_RADIUS_KM = 6371;

/** Distance à vol d'oiseau entre deux points, en km. */
export function haversineKm(a: Point, b: Point): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Arrondi au multiple de 500 GNF supérieur (les prix ronds sont plus simples à encaisser). */
export function roundUpGNF(value: number, step = 500): number {
  return Math.ceil(value / step) * step;
}

/**
 * Ordre de passage conseillé depuis le point de départ : toujours l'arrêt le plus proche
 * (plus proche voisin). Suffisant pour quelques arrêts sur une ville en longueur comme Conakry.
 * Renvoie l'ordre et les km estimés par la route (vol d'oiseau × facteur route).
 */
export function planRoute(
  start: Point,
  stops: Stop[],
  options: { includeReturn: boolean; roadFactor: number },
): { order: string[]; km: number } {
  const remaining = [...stops];
  const order: string[] = [];
  let position = start;
  let km = 0;

  while (remaining.length > 0) {
    let bestIndex = 0;
    for (let i = 1; i < remaining.length; i++) {
      if (haversineKm(position, remaining[i]) < haversineKm(position, remaining[bestIndex])) bestIndex = i;
    }
    const [next] = remaining.splice(bestIndex, 1);
    km += haversineKm(position, next);
    order.push(next.id);
    position = next;
  }
  if (options.includeReturn && order.length > 0) km += haversineKm(position, start);

  return { order, km: Math.round(km * options.roadFactor * 10) / 10 };
}

/**
 * Coût d'une tournée pour le livreur : prise en charge + km + supplément par arrêt au-delà du
 * premier. Deux clientes voisines ajoutent ~0 km : seul le petit supplément compte.
 */
export function runCost(settings: RunCostSettings, km: number, stopCount: number): number {
  if (stopCount === 0) return 0;
  return roundUpGNF(settings.baseFee + km * settings.perKm + Math.max(stopCount - 1, 0) * settings.perExtraStop);
}

/**
 * Fourchette de frais suggérée pour un quartier : coût d'une course seule (aller simple)
 * jusqu'au quartier, puis +30 % pour les adresses éloignées au sein du quartier.
 */
export function suggestFeeRange(settings: RunCostSettings, from: Point, to: Point): { feeMin: number; feeMax: number } {
  const km = haversineKm(from, to) * settings.roadFactor;
  const feeMin = roundUpGNF(settings.baseFee + km * settings.perKm);
  return { feeMin, feeMax: roundUpGNF(feeMin * 1.3) };
}

/** « 10 000 – 15 000 GNF », « 10 000 GNF » si fixe, null si non renseigné. */
export function formatFeeRange(feeMin: number | null | undefined, feeMax: number | null | undefined): string | null {
  if (feeMin == null && feeMax == null) return null;
  const min = feeMin ?? feeMax!;
  const max = feeMax ?? feeMin!;
  const fmt = (v: number) => v.toLocaleString("fr-GN");
  return min === max ? `${fmt(min)} GNF` : `${fmt(Math.min(min, max))} – ${fmt(Math.max(min, max))} GNF`;
}

/** Lien Google Maps vers un point (ouvre l'appli sur téléphone). */
export function mapsUrl(point: Point): string {
  return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`;
}

/** Position plausible en Guinée (garde-fou sur les positions partagées). */
export function isInGuinea(point: Point): boolean {
  return point.lat >= 7 && point.lat <= 13 && point.lng >= -15.5 && point.lng <= -7.5;
}
