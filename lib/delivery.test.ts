import { describe, expect, it } from "vitest";

import { formatFeeRange, haversineKm, isInGuinea, planRoute, roundUpGNF, runCost, suggestFeeRange } from "./delivery";

const settings = { baseFee: 5000, perKm: 1000, perExtraStop: 1000, includeReturn: true, roadFactor: 1.3 };
const kaloum = { lat: 9.5092, lng: -13.7122 };
const kipe = { lat: 9.604, lng: -13.656 };

describe("haversineKm", () => {
  it("≈ 12 km à vol d'oiseau entre Kaloum et Kipé", () => {
    expect(haversineKm(kaloum, kipe)).toBeGreaterThan(11);
    expect(haversineKm(kaloum, kipe)).toBeLessThan(13);
  });

  it("0 pour un même point", () => {
    expect(haversineKm(kipe, kipe)).toBe(0);
  });
});

describe("planRoute", () => {
  const stops = [
    { id: "loin", lat: 9.66, lng: -13.575 },
    { id: "proche", lat: 9.536, lng: -13.693 },
    { id: "milieu", lat: 9.573, lng: -13.645 },
  ];

  it("passe toujours par l'arrêt le plus proche", () => {
    expect(planRoute(kaloum, stops, { includeReturn: false, roadFactor: 1 }).order).toEqual(["proche", "milieu", "loin"]);
  });

  it("le retour est compté si demandé, facteur route appliqué", () => {
    const aller = planRoute(kaloum, stops, { includeReturn: false, roadFactor: 1 }).km;
    const allerRetour = planRoute(kaloum, stops, { includeReturn: true, roadFactor: 1 }).km;
    expect(allerRetour).toBeGreaterThan(aller);
    expect(planRoute(kaloum, stops, { includeReturn: false, roadFactor: 1.3 }).km).toBeCloseTo(aller * 1.3, 0);
  });

  it("une deuxième cliente dans le même quartier n'ajoute pas de km", () => {
    const one = planRoute(kaloum, [{ id: "a", ...kipe }], { includeReturn: true, roadFactor: 1.3 });
    const two = planRoute(kaloum, [{ id: "a", ...kipe }, { id: "b", ...kipe }], { includeReturn: true, roadFactor: 1.3 });
    expect(two.km).toBe(one.km);
  });

  it("sans arrêt : 0 km", () => {
    expect(planRoute(kaloum, [], settings)).toEqual({ order: [], km: 0 });
  });
});

describe("runCost", () => {
  it("prise en charge + km + supplément à partir du 2e arrêt, arrondi à 500", () => {
    // 5 000 + 12,3 × 1 000 + 2 × 1 000 = 19 300 → 19 500
    expect(runCost(settings, 12.3, 3)).toBe(19_500);
  });

  it("trois clientes voisines coûtent bien moins que trois courses séparées", () => {
    const tournee = runCost(settings, 31, 3);
    const troisCourses = 3 * runCost(settings, 31, 1);
    expect(tournee).toBeLessThan(troisCourses / 2);
  });

  it("aucun arrêt : 0", () => {
    expect(runCost(settings, 10, 0)).toBe(0);
  });
});

describe("suggestFeeRange / formatFeeRange / roundUpGNF", () => {
  it("suggestion : course seule jusqu'au quartier, +30 % en haut de fourchette", () => {
    const { feeMin, feeMax } = suggestFeeRange(settings, kaloum, kipe);
    expect(feeMin % 500).toBe(0);
    expect(feeMax).toBeGreaterThanOrEqual(feeMin * 1.3);
    expect(feeMin).toBeGreaterThan(settings.baseFee);
  });

  it("formatage", () => {
    expect(formatFeeRange(10000, 15000)).toMatch(/^10.000 – 15.000 GNF$/);
    expect(formatFeeRange(10000, 10000)).toMatch(/^10.000 GNF$/);
    expect(formatFeeRange(null, null)).toBeNull();
    expect(roundUpGNF(10_001)).toBe(10_500);
  });

  it("position plausible en Guinée", () => {
    expect(isInGuinea(kipe)).toBe(true);
    expect(isInGuinea({ lat: 48.85, lng: 2.35 })).toBe(false);
  });
});
