import { describe, expect, it } from "vitest";

import { orderItemLabel } from "./order-items";

describe("orderItemLabel", () => {
  it("kit, produit, produit avec taille, produit supprimé", () => {
    expect(orderItemLabel({ kit: { name: "Kit Lèvres" }, product: null })).toBe("Kit Lèvres (kit)");
    expect(orderItemLabel({ product: { name: "Savon" } })).toBe("Savon");
    expect(orderItemLabel({ product: { name: "Savon" }, productSize: { label: "100g" } })).toBe("Savon — 100g");
    expect(orderItemLabel({ product: null, kit: null })).toBe("Produit supprimé");
  });
});
