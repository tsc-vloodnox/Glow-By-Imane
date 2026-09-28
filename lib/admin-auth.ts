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
// ADMIN_SECRET=une_chaine_aleatoire_longue_et_unique   ← obligatoire
//
// Changer ADMIN_PASSWORD ou ADMIN_SECRET déconnecte toutes les sessions ouvertes.
// ────────────────────────────────────────────────────────────────────────────

export const ADMIN_COOKIE_NAME = "glow-admin-session";

// Durée de session : 8 heures (en secondes)
export const SESSION_MAX_AGE = 60 * 60 * 8;

// ─── Helpers crypto (Web Crypto : fonctionne dans le proxy comme dans les actions) ──

const encoder = new TextEncoder();

async function sha256(value: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

/** Comparaison en temps constant de deux empreintes de même longueur. */
function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/**
 * Clé de signature des sessions : dérivée de ADMIN_SECRET ET de ADMIN_PASSWORD.
 * Changer le mot de passe (ou le secret) invalide donc immédiatement toutes les
 * sessions ouvertes — c'est le moyen de "déconnecter tout le monde".
 */
async function getSigningKey(usage: "sign" | "verify"): Promise<CryptoKey | null> {
  const secret = process.env.ADMIN_SECRET;
  const password = process.env.ADMIN_PASSWORD;
  if (!secret || !password) return null;

  return crypto.subtle.importKey(
    "raw",
    await sha256(`${secret}\u0000${password}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

// ─── Vérification des credentials (serveur uniquement) ──────────────────────

/**
 * Compare en temps constant (via empreintes SHA-256, pour ne révéler ni le
 * contenu ni la longueur) : empêche de deviner les identifiants caractère par
 * caractère en mesurant le temps de réponse.
 */
export async function isAdminCredentialsValid(phone: string, password: string): Promise<boolean> {
  const expectedPhone = process.env.ADMIN_PHONE;
  const expectedPassword = process.env.ADMIN_PASSWORD;

  if (!expectedPhone || !expectedPassword) {
    console.error("[admin-auth] ADMIN_PHONE ou ADMIN_PASSWORD manquant dans les variables d'environnement.");
    return false;
  }

  const [phoneOk, passwordOk] = await Promise.all([
    Promise.all([sha256(phone), sha256(expectedPhone)]).then(([a, b]) => constantTimeEqual(a, b)),
    Promise.all([sha256(password), sha256(expectedPassword)]).then(([a, b]) => constantTimeEqual(a, b)),
  ]);
  return phoneOk && passwordOk;
}

// ─── Génération du token signé (serveur uniquement) ─────────────────────────

export async function buildSignedToken(phone: string): Promise<string> {
  const key = await getSigningKey("sign");
  if (!key) throw new Error("[admin-auth] ADMIN_SECRET ou ADMIN_PASSWORD manquant dans les variables d'environnement.");

  const issuedAt = Date.now();
  const payload = `${encodeURIComponent(phone)}.${issuedAt}`;

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const sigHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Format final : phone.issuedAt.signature
  return `${payload}.${sigHex}`;
}

// ─── Vérification du token (middleware + serveur) ───────────────────────────

export async function isSignedTokenValid(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;

  const parts = token.split(".");
  // Attend exactement 3 parties : phone, issuedAt, signature
  if (parts.length !== 3) return false;

  const [encodedPhone, issuedAtStr, sigHex] = parts;
  const issuedAt = Number(issuedAtStr);

  // Horodatage invalide, dans le futur, ou token expiré ?
  if (!Number.isFinite(issuedAt) || issuedAt > Date.now() + 60_000) return false;
  if (Date.now() - issuedAt > SESSION_MAX_AGE * 1000) return false;

  // Signature : 64 caractères hexadécimaux (HMAC-SHA256)
  if (!/^[0-9a-f]{64}$/.test(sigHex)) return false;

  try {
    const key = await getSigningKey("verify");
    if (!key) return false;

    const expectedSig = new Uint8Array(sigHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
    // crypto.subtle.verify compare la signature en temps constant
    return await crypto.subtle.verify("HMAC", key, expectedSig, encoder.encode(`${encodedPhone}.${issuedAtStr}`));
  } catch {
    return false;
  }
}
