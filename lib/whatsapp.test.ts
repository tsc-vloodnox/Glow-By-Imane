import { describe, expect, it } from "vitest";

import { buildWhatsAppUrl, buildWholesaleMessage, normalizeGuineaPhone } from "./whatsapp";

describe("normalizeGuineaPhone", () => {
  it.each([
    ["620000000", "224620000000"],
    ["620 00 00 00", "224620000000"],
    ["+224 620 00 00 00", "224620000000"],
    ["224620000000", "224620000000"],
    ["0620000000", "224620000000"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeGuineaPhone(input)).toBe(expected);
  });
});

describe("buildWhatsAppUrl", () => {
  it("encode le message", () => {
    expect(buildWhatsAppUrl("620000000", "Bonjour & merci")).toBe(
      "https://wa.me/224620000000?text=Bonjour%20%26%20merci",
    );
  });
});

describe("buildWholesaleMessage", () => {
  const request = {
    number: 42,
    estimatedTotal: 240_000,
    name: "Mariama",
    phone: "622334455",
    quartier: "Kindia",
    businessName: "Beauté Mariama",
  };
  const decode = (url: string) => decodeURIComponent(url.split("?text=")[1]);

  it("indique le prix souhaité par ligne et le total selon ces prix", () => {
    const text = decode(
      buildWholesaleMessage({
        ...request,
        lines: [
          { label: "Crème Éclat", quantity: 30, unitPrice: 7000, requestedUnitPrice: 6000 },
          { label: "Savon Doux — 100g", quantity: 5, unitPrice: 6000, requestedUnitPrice: null },
        ],
      }),
    );
    // "." dans les regex : l'espace des milliers peut être insécable selon la locale
    expect(text).toMatch(/- Crème Éclat x30 — souhaité : 6.000 GNF\/u \(indicatif 7.000\)/);
    expect(text).toContain("- Savon Doux — 100g x5\n");
    // 30 × 6 000 + 5 × 6 000 (indicatif, sans prix souhaité)
    expect(text).toMatch(/Total selon mes prix souhaités : 210.000 GNF/);
  });

  it("sans prix souhaité : pas de ligne « total souhaité »", () => {
    const text = decode(
      buildWholesaleMessage({ ...request, lines: [{ label: "Crème Éclat", quantity: 30, unitPrice: 7000 }] }),
    );
    expect(text).not.toContain("souhaité");
    expect(text).toContain("Demande revendeur #42");
  });
});
