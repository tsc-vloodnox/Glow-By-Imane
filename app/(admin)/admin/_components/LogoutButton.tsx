"use client";

/**
 * app/admin/_components/LogoutButton.tsx
 *
 * Bouton de déconnexion — appelle logoutAction (Server Action).
 * À placer dans le layout admin (sidebar ou header).
 */

import { useTransition } from "react";

import { logoutAction } from "../login/actions";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => logoutAction())}
      disabled={isPending}
      className="mt-auto block w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--color-muted)] hover:bg-[var(--color-blush)] disabled:opacity-50"
    >
      {isPending ? "Déconnexion…" : "Se déconnecter"}
    </button>
  );
}
