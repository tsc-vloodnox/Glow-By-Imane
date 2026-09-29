import { describe, expect, it } from "vitest";

import { toDate, toInt, toJsonArray } from "./form-validation";

describe("toInt", () => {
  it("convertit les nombres et les chaînes (espaces ignorés)", () => {
    expect(toInt("15 000", "Prix")).toBe(15_000);
    expect(toInt(42, "Prix")).toBe(42);
  });

  it.each(["abc", "1.5", 2.5, "-1", -1])("refuse %s", (value) => {
    expect(() => toInt(value, "Prix")).toThrow(/Prix/);
  });

  it("respecte min et max", () => {
    expect(() => toInt(0, "Pourcentage", { min: 1, max: 99 })).toThrow(/supérieur ou égal à 1/);
    expect(() => toInt(100, "Pourcentage", { min: 1, max: 99 })).toThrow(/inférieur ou égal à 99/);
  });

  it("valeur vide optionnelle avec minimum négatif : 0, pas le minimum", () => {
    expect(toInt("", "Stock", { optional: true, min: -1_000_000 })).toBe(0);
    expect(toInt("-20", "Stock", { min: -1_000_000 })).toBe(-20);
  });

  it("valeur vide : erreur, sauf si optionnelle (renvoie 0, ou min s'il est positif)", () => {
    expect(() => toInt("", "Prix")).toThrow(/Prix requis/);
    expect(toInt("", "Stock", { optional: true })).toBe(0);
    expect(toInt(null, "Remise", { optional: true })).toBe(0);
  });
});

describe("toDate", () => {
  it("accepte une date ISO", () => {
    expect(toDate("2026-09-28T10:00", "Date").getFullYear()).toBe(2026);
  });

  it("refuse une date invalide", () => {
    expect(() => toDate("pas une date", "Date")).toThrow(/Date invalide/);
    expect(() => toDate(undefined, "Date")).toThrow(/Date invalide/);
  });
});

describe("toJsonArray", () => {
  it("parse un tableau JSON", () => {
    expect(toJsonArray('[{"a":1}]', "Items")).toEqual([{ a: 1 }]);
    expect(toJsonArray(null, "Items")).toEqual([]);
  });

  it("refuse du JSON invalide ou un non-tableau", () => {
    expect(() => toJsonArray("{", "Items")).toThrow(/données invalides/);
    expect(() => toJsonArray('{"a":1}', "Items")).toThrow(/données invalides/);
  });
});
