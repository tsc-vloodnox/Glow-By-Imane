/**
 * middleware.ts  (racine du projet, à côté de /app)
 *
 * Protège toutes les routes /admin/* sauf /admin/login.
 * Utilise isSignedTokenValid() — vérification HMAC async.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ADMIN_COOKIE_NAME, isSignedTokenValid } from "@/lib/admin-auth";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;

  // ── /admin/login : si déjà connecté → redirige vers dashboard ──────────
  if (pathname === "/admin/login") {
    if (await isSignedTokenValid(token)) {
      return NextResponse.redirect(new URL("/admin/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // ── Toutes les autres routes /admin/* : vérifie le token ────────────────
  if (pathname.startsWith("/admin")) {
    if (!(await isSignedTokenValid(token))) {
      const loginUrl = new URL("/admin/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
