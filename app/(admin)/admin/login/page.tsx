"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ADMIN_COOKIE_NAME, buildAdminCookieValue } from "@/lib/admin-auth";

export default function AdminLoginPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const phone = String(formData.get("phone") || "").trim();
    const password = String(formData.get("password") || "").trim();

    if (!phone || !password) {
      setError("Veuillez saisir votre numéro et votre mot de passe.");
      return;
    }

    document.cookie = `${ADMIN_COOKIE_NAME}=${buildAdminCookieValue(phone, password)}; path=/; max-age=3600; SameSite=Lax`;
    router.refresh();
    router.push("/admin/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-sand)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm">
        <h1 className="font-serif text-2xl text-[var(--color-accent)]">Connexion admin</h1>
        <p className="mt-2 text-sm text-[var(--color-muted)]">Accès réservé au personnel Glow by Imane.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Numéro</span>
            <input name="phone" className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3" placeholder="620000000" />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium">Mot de passe</span>
            <input name="password" type="password" className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3" placeholder="••••••••" />
          </label>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button type="submit" className="w-full rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white">
            Se connecter
          </button>
        </form>
      </div>
    </div>
  );
}
