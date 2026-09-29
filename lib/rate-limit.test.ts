import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkRateLimit, isRateLimited, recordRateLimitHit, resetMemoryRateLimits } from "./rate-limit";

// Sans variables Upstash : backend mémoire
beforeEach(() => {
  resetMemoryRateLimits();
  vi.useRealTimers();
});

describe("checkRateLimit (mémoire)", () => {
  it("autorise jusqu'à la limite puis refuse", async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await checkRateLimit("ip:1", 3, 60_000));
    expect(results).toEqual([true, true, true, false]);
  });

  it("renvoie une Promise : un appel sans await serait toujours « vrai »", () => {
    expect(checkRateLimit("ip:2", 1, 60_000)).toBeInstanceOf(Promise);
  });

  it("clés indépendantes", async () => {
    expect(await checkRateLimit("ip:a", 1, 60_000)).toBe(true);
    expect(await checkRateLimit("ip:b", 1, 60_000)).toBe(true);
    expect(await checkRateLimit("ip:a", 1, 60_000)).toBe(false);
  });

  it("la fenêtre glisse : autorisé de nouveau après expiration", async () => {
    vi.useFakeTimers();
    expect(await checkRateLimit("ip:3", 1, 1_000)).toBe(true);
    expect(await checkRateLimit("ip:3", 1, 1_000)).toBe(false);
    vi.advanceTimersByTime(1_001);
    expect(await checkRateLimit("ip:3", 1, 1_000)).toBe(true);
  });
});

describe("isRateLimited / recordRateLimitHit (blocage du login)", () => {
  it("consulter ne compte pas d'essai ; seuls les échecs enregistrés bloquent", async () => {
    for (let i = 0; i < 10; i++) expect(await isRateLimited("login:1", 5, 60_000)).toBe(false);
    for (let i = 0; i < 5; i++) await recordRateLimitHit("login:1", 5, 60_000);
    expect(await isRateLimited("login:1", 5, 60_000)).toBe(true);
  });
});

describe("Upstash configuré mais injoignable", () => {
  it("repli sur le compteur mémoire : le site continue de fonctionner et de limiter", async () => {
    vi.resetModules();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://127.0.0.1:1");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rl = await import("./rate-limit");

    expect(await rl.checkRateLimit("ip:down", 1, 60_000)).toBe(true);
    expect(await rl.checkRateLimit("ip:down", 1, 60_000)).toBe(false);
    expect(spy).toHaveBeenCalled();

    spy.mockRestore();
    vi.unstubAllEnvs();
  }, 30_000);
});
