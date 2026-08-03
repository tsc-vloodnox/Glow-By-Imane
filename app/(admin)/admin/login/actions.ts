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

  if (!isAdminCredentialsValid(phone, password)) {
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
  const safeNext = next.startsWith("/admin") ? next : "/admin/dashboard";
  redirect(safeNext);
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
  redirect("/admin/login");
}
