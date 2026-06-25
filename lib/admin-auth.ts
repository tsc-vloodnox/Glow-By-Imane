/**
 * lib/admin-auth.ts
 *
 * Stratégie : le cookie ne contient JAMAIS le mot de passe.
 * On stocke une signature HMAC-SHA256 de (phone + timestamp),
 * signée avec ADMIN_SECRET (variable d'env, jamais exposée côté client).
 *
 * Flux :
 *   1. Login → Server Action vérifie phone + password contre les env vars
 *   2. Si OK → génère un token signé HMAC et le pose en cookie HttpOnly
 *   3. Middleware → vérifie la signature HMAC à chaque requête /admin/*
 */

// ─── Variables d'environnement attendues dans .env.local ────────────────────
// ADMIN_PHONE=620000000
// ADMIN_PASSWORD=ton_mot_de_passe_fort
// ADMIN_SECRET=une_chaine_aleatoire_longue_et_unique   ← nouveau, obligatoire
// ────────────────────────────────────────────────────────────────────────────

export const ADMIN_COOKIE_NAME = "glow-admin-session";

// Durée de session : 8 heures (en secondes)
export const SESSION_MAX_AGE = 60 * 60 * 8;

// ─── Vérification des credentials (serveur uniquement) ──────────────────────

export function isAdminCredentialsValid(phone: string, password: string): boolean {
  const expectedPhone = process.env.ADMIN_PHONE;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedPhone || !expectedPassword) {
    console.error("[admin-auth] ADMIN_PHONE ou ADMIN_PASSWORD manquant dans les variables d'environnement.");
    return false;
  }

  return phone === expectedPhone && password === expectedPassword;
}

// ─── Génération du token signé (serveur uniquement) ─────────────────────────

export async function buildSignedToken(phone: string): Promise<string> {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error("[admin-auth] ADMIN_SECRET manquant dans les variables d'environnement.");

  const issuedAt = Date.now();
  const payload = `${encodeURIComponent(phone)}.${issuedAt}`;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Format final : phone.issuedAt.signature
  return `${payload}.${sigHex}`;
}

// ─── Vérification du token (middleware + serveur) ───────────────────────────

export async function isSignedTokenValid(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;

  const secret = process.env.ADMIN_SECRET;
  if (!secret) return false;

  const parts = token.split(".");
  // Attend exactement 3 parties : phone, issuedAt, signature
  if (parts.length !== 3) return false;

  const [encodedPhone, issuedAtStr, sigHex] = parts;
  const issuedAt = Number(issuedAtStr);

  // Token expiré ?
  if (Date.now() - issuedAt > SESSION_MAX_AGE * 1000) return false;

  // Recalcule la signature et compare
  const payload = `${encodedPhone}.${issuedAtStr}`;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    const expectedSig = new Uint8Array(
      sigHex.match(/.{1,2}/g)!.map((b) => parseInt(b, 16)),
    );

    return await crypto.subtle.verify("HMAC", key, expectedSig, new TextEncoder().encode(payload));
  } catch {
    return false;
  }
}
