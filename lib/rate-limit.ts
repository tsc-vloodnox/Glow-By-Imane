// Destination : lib/rate-limit.ts
// Limiteur de débit (fenêtre glissante), par clé (ex: IP, téléphone).
//
// - Upstash Redis configuré (UPSTASH_REDIS_REST_URL/TOKEN, ou KV_REST_API_URL/TOKEN
//   ajoutés par l'intégration Vercel) : compteur PARTAGÉ entre toutes les instances.
// - Sinon : compteur en mémoire, par instance serverless (best-effort, se réinitialise
//   au cold start). Suffisant en développement et pour freiner un script naïf.
// - Upstash injoignable : repli sur la mémoire, le site continue de fonctionner.

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";

// ─── Backend mémoire ─────────────────────────────────────────────────────────

const buckets = new Map<string, number[]>();
const MAX_TRACKED_KEYS = 10_000;

function recentHits(key: string, windowMs: number, now: number): number[] {
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  buckets.set(key, recent);
  return recent;
}

function trimBuckets() {
  // Évite une croissance mémoire illimitée : on purge les plus anciennes clés
  if (buckets.size > MAX_TRACKED_KEYS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey !== undefined) buckets.delete(oldestKey);
  }
}

const memory = {
  isLimited: (key: string, limit: number, windowMs: number) => recentHits(key, windowMs, Date.now()).length >= limit,
  hit: (key: string, windowMs: number) => {
    const now = Date.now();
    recentHits(key, windowMs, now).push(now);
    trimBuckets();
  },
};

/** Vide le compteur mémoire (tests). */
export function resetMemoryRateLimits() {
  buckets.clear();
}

// ─── Backend Upstash ─────────────────────────────────────────────────────────

function upstashCredentials(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

const UPSTASH_TIMEOUT_MS = 1_500;

let redis: Redis | null | undefined;
const limiters = new Map<string, Ratelimit>();

/** Limiteur Upstash pour une configuration (limite, fenêtre), ou null si non configuré. */
function upstashLimiter(limit: number, windowMs: number): Ratelimit | null {
  if (redis === undefined) {
    const credentials = upstashCredentials();
    redis = credentials
      ? new Redis({
          ...credentials,
          // Une panne d'Upstash ne doit pas ralentir les commandes : 1 nouvel essai max,
          // et chaque requête abandonnée au bout de UPSTASH_TIMEOUT_MS (→ repli mémoire).
          retry: { retries: 1, backoff: () => 100 },
          signal: () => AbortSignal.timeout(UPSTASH_TIMEOUT_MS),
        })
      : null;
  }
  if (!redis) return null;

  const configKey = `${limit}:${windowMs}`;
  let limiter = limiters.get(configKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
      prefix: `glow-rl:${configKey}`,
      timeout: UPSTASH_TIMEOUT_MS,
    });
    limiters.set(configKey, limiter);
  }
  return limiter;
}

function logUpstashError(error: unknown) {
  console.error("[rate-limit] Upstash injoignable, repli sur le compteur mémoire.", error);
}

// ─── API ─────────────────────────────────────────────────────────────────────

/** true si la limite est atteinte, SANS compter de nouvel essai (ex: bloquer un login). */
export async function isRateLimited(key: string, limit: number, windowMs: number): Promise<boolean> {
  const limiter = upstashLimiter(limit, windowMs);
  if (limiter) {
    try {
      return (await limiter.getRemaining(key)).remaining <= 0;
    } catch (error) {
      logUpstashError(error);
    }
  }
  return memory.isLimited(key, limit, windowMs);
}

/** Enregistre un essai (ex: un échec de connexion). */
export async function recordRateLimitHit(key: string, limit: number, windowMs: number): Promise<void> {
  const limiter = upstashLimiter(limit, windowMs);
  if (limiter) {
    try {
      await limiter.limit(key);
      return;
    } catch (error) {
      logUpstashError(error);
    }
  }
  memory.hit(key, windowMs);
}

/** Retourne true si l'action est autorisée (et la compte), false si la limite est atteinte. */
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const limiter = upstashLimiter(limit, windowMs);
  if (limiter) {
    try {
      return (await limiter.limit(key)).success;
    } catch (error) {
      logUpstashError(error);
    }
  }
  if (memory.isLimited(key, limit, windowMs)) return false;
  memory.hit(key, windowMs);
  return true;
}

/** IP du client telle que transmise par le proxy (Vercel renseigne x-forwarded-for). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
