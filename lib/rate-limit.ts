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

/** Retourne true si l'action est autorisée, false si la limite est atteinte. */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);

  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }

  recent.push(now);
  buckets.set(key, recent);

  // Évite une croissance mémoire illimitée : on purge les plus anciennes clés
  if (buckets.size > MAX_TRACKED_KEYS) {
    const oldestKey = buckets.keys().next().value;
    if (oldestKey !== undefined) buckets.delete(oldestKey);
  }

  return true;
}

/** IP du client telle que transmise par le proxy (Vercel renseigne x-forwarded-for). */
export async function getClientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
