/**
 * app/admin/layout.tsx
 *
 * Layout admin avec bouton de déconnexion dans la sidebar.
 */

import Link from "next/link";

import { LogoutButton } from "./_components/LogoutButton";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/commandes", label: "Commandes" },
  { href: "/admin/produits", label: "Produits" },
  { href: "/admin/livraisons", label: "Livraisons" }, // ← on ajoutera ça à l'étape suivante
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-sand)]">
      <div className="mx-auto flex min-h-screen max-w-6xl">
        <aside className="hidden w-56 shrink-0 flex-col border-r border-[var(--color-border)] bg-white p-6 md:flex">
          <p className="font-serif text-lg text-[var(--color-accent)]">Glow by Imane</p>
          <p className="mb-6 text-xs text-[var(--color-muted)]">Administration</p>

          <nav className="space-y-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm hover:bg-[var(--color-blush)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Bouton déconnexion en bas de sidebar */}
          <div className="mt-auto pt-6 border-t border-[var(--color-border)]">
            <LogoutButton />
          </div>
        </aside>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
