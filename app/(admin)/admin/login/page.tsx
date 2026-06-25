"use client";

/**
 * app/admin/login/page.tsx
 *
 * Page de connexion — utilise la Server Action loginAction.
 * Plus de cookie posé côté client, plus de mot de passe dans le navigateur.
 */

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";

import { loginAction } from "./actions";

export default function AdminLoginPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/admin/dashboard";

  const [state, formAction, isPending] = useActionState(loginAction, null);
 
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-sand)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
        <h1 className="font-serif text-2xl text-[var(--color-accent)]">Connexion admin</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">
          Accès réservé au personnel Glow by Imane.
        </p>

        <form action={formAction} className="mt-6 space-y-4">
          {/* Transmet le paramètre "next" au server action */}
          <input type="hidden" name="next" value={next} />

          <label className="block space-y-1">
            <span className="text-sm font-medium">Numéro</span>
            <input
              name="phone"
              type="tel"
              required
              autoComplete="username"
              className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3"
              placeholder="620000000"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Mot de passe</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3"
              placeholder="••••••••"
            />
          </label>

          {state?.error ? (
            <p className="text-sm text-red-600">{state.error}</p>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {isPending ? "Connexion…" : "Se connecter"}
          </button>
        </form>
      </div>
    </div>
  );
}
