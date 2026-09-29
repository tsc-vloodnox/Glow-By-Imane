"use server";

/**
 * app/admin/login/actions.ts
 *
 * Server Action pour le login admin.
 * Toute la logique de validation + cookie se passe côté serveur.
 * Le mot de passe ne transite JAMAIS vers le navigateur.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import {
  ADMIN_COOKIE_NAME,
  SESSION_MAX_AGE,
  buildSignedToken,
  isAdminCredentialsValid,
} from "@/lib/admin-auth";
import { getClientIp, isRateLimited, recordRateLimitHit } from "@/lib/rate-limit";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

type LoginActionState = { error: string } | null;

export async function loginAction(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();
  const next = String(formData.get("next") ?? "/admin/dashboard");

  // Validation côté serveur
  if (!phone || !password) {
    return { error: "Veuillez saisir votre numéro et votre mot de passe." };
  }

  // Anti brute-force : au-delà de N échecs par IP, connexion bloquée un moment
  const rateLimitKey = `admin-login:${await getClientIp()}`;
  if (await isRateLimited(rateLimitKey, MAX_FAILED_ATTEMPTS, LOCKOUT_WINDOW_MS)) {
    return { error: "Trop de tentatives échouées. Réessayez dans 15 minutes." };
  }

  if (!(await isAdminCredentialsValid(phone, password))) {
    await recordRateLimitHit(rateLimitKey, MAX_FAILED_ATTEMPTS, LOCKOUT_WINDOW_MS);
    // Délai volontaire pour ralentir le brute-force
    await new Promise((r) => setTimeout(r, 500));
    return { error: "Identifiants incorrects." };
  }

  // Génère un token signé HMAC
  const token = await buildSignedToken(phone);

  // Pose le cookie depuis le serveur : HttpOnly + Secure + SameSite=Lax
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,        // ← inaccessible au JS navigateur
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });

  // Redirige vers la destination demandée (ou dashboard par défaut)
  // Uniquement un chemin interne de l'admin (pas "//", "\\" ni URL absolue → pas d'open redirect)
  const safeNext = /^\/admin(\/[\w\-/]*)?$/.test(next) ? next : "/admin/dashboard";
  redirect(safeNext);
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
  redirect("/admin/login");
}
