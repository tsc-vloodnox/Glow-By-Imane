import { describe, expect, it } from "vitest";

import { slugify } from "./slug";

describe("slugify", () => {
  it.each([
    ["Crème Lèvres Rosées", "creme-levres-rosees"],
    ["Gant de Gommage Élégance +", "gant-de-gommage-elegance"],
    ["Kit  Lèvres — Méga!!", "kit-levres-mega"],
    ["Sœur & Cœur", "soeur-coeur"],
    ["+++", ""],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("limite la longueur sans tiret final", () => {
    const slug = slugify("a".repeat(79) + " b");
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });
});
