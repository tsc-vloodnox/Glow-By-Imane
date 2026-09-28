import { describe, expect, it } from "vitest";

import { UserError } from "./action-result";
import { MAX_LINE_QUANTITY, MAX_ORDER_LINES, parseOrderInput } from "./order-validation";

const base = { name: "Aïssatou", phone: "620 00 00 00", quartier: "Kaloum" };
const product = (quantity: unknown) => ({ kind: "product", productId: "p1", quantity });

describe("parseOrderInput", () => {
  it("accepte une commande valide et normalise le téléphone", () => {
    const order = parseOrderInput({ ...base, items: [product(2)] });
    expect(order.phone).toBe("620000000");
    expect(order.items).toEqual([{ kind: "product", productId: "p1", productSizeId: null, quantity: 2 }]);
  });

  it.each([-5, 0, 1.5, MAX_LINE_QUANTITY + 1, "2", null])("refuse la quantité %s", (quantity) => {
    expect(() => parseOrderInput({ ...base, items: [product(quantity)] })).toThrow(/Quantité invalide/);
  });

  it("lève des UserError (message affichable)", () => {
    expect(() => parseOrderInput({ ...base, items: [] })).toThrow(UserError);
  });

  it("refuse un panier vide ou trop grand", () => {
    expect(() => parseOrderInput({ ...base, items: [] })).toThrow(/panier est vide/);
    const tooMany = Array.from({ length: MAX_ORDER_LINES + 1 }, () => product(1));
    expect(() => parseOrderInput({ ...base, items: tooMany })).toThrow(/Trop d'articles/);
  });

  it("refuse un numéro non guinéen", () => {
    expect(() => parseOrderInput({ ...base, phone: "0612345678", items: [product(1)] })).toThrow(/Téléphone/);
  });

  it("accepte les préfixes 224 et +224", () => {
    expect(parseOrderInput({ ...base, phone: "+224 620 00 00 00", items: [product(1)] }).phone).toBe("+224620000000");
  });

  it("refuse les champs requis vides ou trop longs", () => {
    expect(() => parseOrderInput({ ...base, name: "  ", items: [product(1)] })).toThrow(/Nom requis/);
    expect(() => parseOrderInput({ ...base, comment: "x".repeat(501), items: [product(1)] })).toThrow(/trop long/);
  });

  it("refuse un type d'article inconnu", () => {
    expect(() => parseOrderInput({ ...base, items: [{ kind: "autre", quantity: 1 }] })).toThrow(/Article invalide/);
  });

  describe("carte cadeau", () => {
    const gift = { recipientName: "Mariama", recipientPhone: "621000000", recipientAddress: "Ratoma" };

    it("accepte une photo uploadée dans gifts/", () => {
      const photo = "gifts/123e4567-e89b-12d3-a456-426614174000.webp";
      expect(parseOrderInput({ ...base, items: [product(1)], gift: { ...gift, photo } }).gift?.photo).toBe(photo);
    });

    it("refuse un chemin de photo arbitraire", () => {
      for (const photo of ["../evil.html", "produit.jpg", "gifts/../x.webp"]) {
        expect(() => parseOrderInput({ ...base, items: [product(1)], gift: { ...gift, photo } })).toThrow(/Photo/);
      }
    });

    it("printRequested n'est vrai que s'il vaut exactement true", () => {
      const parsed = parseOrderInput({ ...base, items: [product(1)], gift: { ...gift, printRequested: "yes" } });
      expect(parsed.gift?.printRequested).toBe(false);
    });
  });
});
