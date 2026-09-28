import { describe, expect, it } from "vitest";

import { buildWhatsAppUrl, normalizeGuineaPhone } from "./whatsapp";

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
