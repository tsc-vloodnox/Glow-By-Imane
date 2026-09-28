import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SESSION_MAX_AGE, buildSignedToken, isAdminCredentialsValid, isSignedTokenValid } from "./admin-auth";

beforeEach(() => {
  vi.stubEnv("ADMIN_PHONE", "620000000");
  vi.stubEnv("ADMIN_PASSWORD", "mot-de-passe");
  vi.stubEnv("ADMIN_SECRET", "secret-de-test");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("isAdminCredentialsValid", () => {
  it("accepte les bons identifiants", async () => {
    expect(await isAdminCredentialsValid("620000000", "mot-de-passe")).toBe(true);
  });

  it("refuse un mauvais mot de passe ou téléphone", async () => {
    expect(await isAdminCredentialsValid("620000000", "mot-de-pass")).toBe(false);
    expect(await isAdminCredentialsValid("620000001", "mot-de-passe")).toBe(false);
  });

  it("refuse tout si la configuration est absente", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(await isAdminCredentialsValid("620000000", "")).toBe(false);
  });
});

describe("jeton de session", () => {
  it("un jeton fraîchement signé est valide", async () => {
    expect(await isSignedTokenValid(await buildSignedToken("620000000"))).toBe(true);
  });

  it("toute altération invalide le jeton", async () => {
    const token = await buildSignedToken("620000000");
    const [phone, issuedAt, sig] = token.split(".");
    const flipped = sig.slice(0, -1) + (sig.endsWith("0") ? "1" : "0");

    expect(await isSignedTokenValid(`${phone}.${issuedAt}.${flipped}`)).toBe(false);
    expect(await isSignedTokenValid(`${phone}.${Number(issuedAt) + 1}.${sig}`)).toBe(false);
    expect(await isSignedTokenValid(`autre.${issuedAt}.${sig}`)).toBe(false);
    expect(await isSignedTokenValid(`${phone}.${issuedAt}`)).toBe(false);
    expect(await isSignedTokenValid("")).toBe(false);
    expect(await isSignedTokenValid(undefined)).toBe(false);
  });

  it("changer le mot de passe déconnecte les sessions existantes", async () => {
    const token = await buildSignedToken("620000000");
    vi.stubEnv("ADMIN_PASSWORD", "nouveau");
    expect(await isSignedTokenValid(token)).toBe(false);
  });

  it("le jeton expire après SESSION_MAX_AGE", async () => {
    vi.useFakeTimers();
    const token = await buildSignedToken("620000000");
    vi.advanceTimersByTime(SESSION_MAX_AGE * 1000 + 1);
    expect(await isSignedTokenValid(token)).toBe(false);
  });
});
