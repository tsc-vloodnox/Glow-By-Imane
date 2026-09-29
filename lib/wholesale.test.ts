import { describe, expect, it } from "vitest";

import { WHOLESALE_MIN_TOTAL_QUANTITY, parseWholesaleInput } from "./wholesale";

const base = { name: "Mariama", phone: "622 11 22 33", quartier: "Kindia", businessName: "Beauté Mariama" };
const line = (quantity: unknown, productSizeId: string | null = null) => ({ productId: "p1", productSizeId, quantity });

describe("parseWholesaleInput", () => {
  it("accepte une demande valide et normalise le téléphone", () => {
    const parsed = parseWholesaleInput({ ...base, items: [line(12)] });
    expect(parsed.phone).toBe("622112233");
    expect(parsed.businessName).toBe("Beauté Mariama");
    expect(parsed.items).toEqual([{ productId: "p1", productSizeId: null, quantity: 12, requestedUnitPrice: null }]);
  });

  it(`refuse moins de ${WHOLESALE_MIN_TOTAL_QUANTITY} unités au total`, () => {
    expect(() => parseWholesaleInput({ ...base, items: [line(4), { productId: "p2", quantity: 5 }] })).toThrow(
      /au moins 10 unités \(actuellement 9\)/,
    );
  });

  it("le minimum se compte toutes lignes confondues", () => {
    expect(parseWholesaleInput({ ...base, items: [line(5), { productId: "p2", quantity: 5 }] }).items).toHaveLength(2);
  });

  it("fusionne les lignes identiques (même produit et même taille)", () => {
    const parsed = parseWholesaleInput({ ...base, items: [line(6, "s1"), line(6, "s1"), line(3, "s2")] });
    expect(parsed.items).toEqual([
      { productId: "p1", productSizeId: "s1", quantity: 12, requestedUnitPrice: null },
      { productId: "p1", productSizeId: "s2", quantity: 3, requestedUnitPrice: null },
    ]);
  });

  it.each([0, -3, 2.5, 10_001, "12"])("refuse la quantité %s", (quantity) => {
    expect(() => parseWholesaleInput({ ...base, items: [line(quantity)] })).toThrow(/Quantité invalide/);
  });

  it("n'impose aucune limite de stock (vérifiée à la confirmation)", () => {
    expect(parseWholesaleInput({ ...base, items: [line(5_000)] }).items[0].quantity).toBe(5_000);
  });

  it("boutique optionnelle, champs requis contrôlés", () => {
    expect(parseWholesaleInput({ ...base, businessName: "", items: [line(10)] }).businessName).toBeUndefined();
    expect(() => parseWholesaleInput({ ...base, quartier: " ", items: [line(10)] })).toThrow(/Ville \/ quartier requis/);
    expect(() => parseWholesaleInput({ ...base, phone: "12345", items: [line(10)] })).toThrow(/Téléphone/);
  });

  describe("prix souhaité", () => {
    const priced = (requestedUnitPrice: unknown) => ({ productId: "p1", quantity: 12, requestedUnitPrice });

    it("facultatif : absent, vide ou 0 → null", () => {
      for (const value of [undefined, null, "", 0]) {
        expect(parseWholesaleInput({ ...base, items: [priced(value)] }).items[0].requestedUnitPrice).toBeNull();
      }
    });

    it("accepte un entier positif", () => {
      expect(parseWholesaleInput({ ...base, items: [priced(6500)] }).items[0].requestedUnitPrice).toBe(6500);
    });

    it.each([-100, 12.5, "6500", 100_000_001])("refuse %s", (value) => {
      expect(() => parseWholesaleInput({ ...base, items: [priced(value)] })).toThrow(/Prix souhaité invalide/);
    });

    it("lignes fusionnées : le dernier prix saisi l'emporte, un vide ne l'efface pas", () => {
      const items = [priced(7000), priced(6500), priced(null)];
      expect(parseWholesaleInput({ ...base, items }).items[0]).toMatchObject({ quantity: 36, requestedUnitPrice: 6500 });
    });
  });
});
