// Destination : lib/rate-limit.ts
// Limiteur de débit en mémoire (fenêtre glissante), par clé (ex: IP).
//
// ⚠️ Best-effort : sur Vercel chaque instance serverless a sa propre mémoire,
// la limite est donc par instance et se réinitialise au cold start. Suffisant
// pour freiner un script naïf ; pour une vraie protection, brancher un store
// partagé (Upstash Redis, Vercel KV) ou une règle WAF Vercel.

import { headers } from "next/headers";

const buckets = new Map<string, number[]>();
const MAX_TRACKED_KEYS = 10_000;

function recentHits(key: string, windowMs: number, now: number): number[] {
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  buckets.set(key, recent);
  return recent;
}

/** true si la limite est atteinte, SANS compter de nouvel essai (ex: bloquer un login). */
export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  return recentHits(key, windowMs, Date.now()).length >= limit;
}

/** Enregistre un essai (ex: un échec de connexion). */
export function recordRateLimitHit(key: string, windowMs: number) {
  const now = Date.now();
  recentHits(key, windowMs, now).push(now);
  trimBuckets();
}

/** Retourne true si l'action est autorisée (et la compte), false si la limite est atteinte. */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  if (isRateLimited(key, limit, windowMs)) return false;
  recordRateLimitHit(key, windowMs);
  return true;
}

function trimBuckets() {
  // Évite une croissance mémoire illimitée : on purge les plus anciennes clés
  if (buckets.size > MAX_TRACKED_KEYS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey !== undefined) buckets.delete(oldestKey);
  }
}

/** IP du client telle que transmise par le proxy (Vercel renseigne x-forwarded-for). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
