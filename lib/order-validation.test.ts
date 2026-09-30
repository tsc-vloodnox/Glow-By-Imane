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

describe("livraison", () => {
  const baseOrder = { name: "Awa", phone: "620000000", items: [{ kind: "product", productId: "p1", quantity: 1 }] };

  it("quartier de la liste : précisions facultatives", () => {
    const parsed = parseOrderInput({ ...baseOrder, deliveryMode: "LIVRAISON", quartierId: "q_kipe", quartier: "" });
    expect(parsed).toMatchObject({ deliveryMode: "LIVRAISON", quartierId: "q_kipe", quartier: "" });
  });

  it("autre quartier : saisie obligatoire", () => {
    expect(() => parseOrderInput({ ...baseOrder, deliveryMode: "LIVRAISON", quartier: " " })).toThrow(/Quartier requis/);
    expect(parseOrderInput({ ...baseOrder, deliveryMode: "LIVRAISON", quartier: "Simbaya" }).quartier).toBe("Simbaya");
  });

  it("retrait : ni quartier ni position", () => {
    const parsed = parseOrderInput({ ...baseOrder, deliveryMode: "RETRAIT", quartierId: "q_kipe", location: { lat: 9.6, lng: -13.6 } });
    expect(parsed).toMatchObject({ deliveryMode: "RETRAIT", quartierId: null, quartier: "", location: null });
  });

  it("mode absent : livraison par défaut", () => {
    expect(parseOrderInput({ ...baseOrder, quartier: "Kaloum" }).deliveryMode).toBe("LIVRAISON");
  });

  it("position : acceptée en Guinée (arrondie), refusée ailleurs ou invalide", () => {
    const ok = parseOrderInput({ ...baseOrder, quartier: "Kipé", location: { lat: 9.6041234, lng: -13.6561234 } });
    expect(ok.location).toEqual({ lat: 9.60412, lng: -13.65612 });
    expect(() => parseOrderInput({ ...baseOrder, quartier: "Kipé", location: { lat: 48.85, lng: 2.35 } })).toThrow(/hors de la zone/);
    expect(() => parseOrderInput({ ...baseOrder, quartier: "Kipé", location: { lat: "9.6", lng: -13.6 } })).toThrow(/Position invalide/);
  });
});
