import { describe, expect, it } from "vitest";

import {
  getEffectiveDiscount,
  resolveActiveUnitPrice,
  resolveDiscountedLineTotal,
  resolveDiscountedUnitPrice,
  resolveLineTotal,
} from "./pricing";

const promo = (discountPercent: number) => ({ discountPercent });

describe("resolveLineTotal (paliers de quantité)", () => {
  const packs = [
    { quantity: 3, price: 25_000 },
    { quantity: 5, price: 40_000 },
  ];

  it("applique les paliers du plus gros au plus petit, puis le prix unitaire", () => {
    // 9 = 5 (40 000) + 3 (25 000) + 1 × 10 000
    expect(resolveLineTotal(10_000, packs, 9)).toBe(75_000);
  });

  it("sans palier : prix unitaire × quantité", () => {
    expect(resolveLineTotal(10_000, [], 4)).toBe(40_000);
  });

  it("quantité nulle ou négative : 0", () => {
    expect(resolveLineTotal(10_000, packs, 0)).toBe(0);
    expect(resolveLineTotal(10_000, packs, -3)).toBe(0);
  });

  it("ignore les paliers de quantité invalide", () => {
    expect(resolveLineTotal(10_000, [{ quantity: 0, price: 1 }], 2)).toBe(20_000);
  });
});

describe("remises : pas de cumul, la meilleure s'applique", () => {
  it("promo plus forte que la remise permanente : promo appliquée au prix d'origine", () => {
    expect(resolveActiveUnitPrice(8_000, [promo(30)], 10_000)).toBe(7_000);
  });

  it("remise permanente plus forte que la promo : on garde le prix remisé", () => {
    expect(resolveActiveUnitPrice(8_000, [promo(10)], 10_000)).toBe(8_000);
  });

  it("sans remise permanente : promo appliquée au prix", () => {
    expect(resolveActiveUnitPrice(8_000, [promo(25)])).toBe(6_000);
  });

  it("plusieurs promos : la plus forte gagne", () => {
    expect(resolveActiveUnitPrice(10_000, [promo(10), promo(40), promo(20)])).toBe(6_000);
  });

  it("promo à 0 % ou absente : prix inchangé", () => {
    expect(resolveActiveUnitPrice(10_000, [promo(0)], 12_000)).toBe(10_000);
    expect(resolveActiveUnitPrice(10_000, [], 12_000)).toBe(10_000);
  });
});

describe("prix affiché = prix facturé", () => {
  const cases: [number, number | null, number[]][] = [
    [8_000, 10_000, [30]],
    [8_000, 10_000, [10]],
    [8_000, 10_000, []],
    [8_000, null, [25]],
    [8_333, 10_000, [5]], // pourcentage permanent non entier (16,67 %)
    [9_999, null, [33]], // arrondi
  ];

  it.each(cases)("prix %i, origine %s, promos %j", (price, originalPrice, promos) => {
    const active = promos.map(promo);
    const displayed = getEffectiveDiscount(price, originalPrice, active)?.discountedPrice ?? price;
    const charged = resolveDiscountedLineTotal(price, active, [], 1, originalPrice);
    expect(charged).toBe(displayed);
  });

  it("le prix barré est le prix d'origine", () => {
    expect(getEffectiveDiscount(8_000, 10_000, [])).toEqual({
      discountedPrice: 8_000,
      referencePrice: 10_000,
      discountPercent: 20,
    });
  });

  it("aucune remise : null", () => {
    expect(getEffectiveDiscount(8_000, null, [])).toBeNull();
    expect(getEffectiveDiscount(8_000, 7_000, [])).toBeNull(); // originalPrice incohérent ignoré
  });
});

describe("promo + paliers", () => {
  it("la promo réduit le prix unitaire, les paliers restent des prix fixes", () => {
    // unitaire 10 000 → 8 000 avec -20 % ; 4 = palier 3 (25 000) + 1 × 8 000
    expect(resolveDiscountedLineTotal(10_000, [promo(20)], [{ quantity: 3, price: 25_000 }], 4)).toBe(33_000);
  });

  it("prix unitaire moyen", () => {
    expect(resolveDiscountedUnitPrice(10_000, [promo(20)], [{ quantity: 3, price: 25_000 }], 4)).toBe(8_250);
  });
});
