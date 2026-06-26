/**
 * app/admin/layout.tsx
 */

import Link from "next/link";

import { AdminMobileNav } from "./_components/AdminMobileNav";
import { LogoutButton } from "./_components/LogoutButton";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/commandes", label: "Commandes" },
  { href: "/admin/produits", label: "Produits" },
  { href: "/admin/livraisons", label: "Livraisons" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-sand)]">
      <div className="mx-auto flex min-h-screen max-w-6xl">

        {/* Sidebar desktop uniquement */}
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

          <div className="mt-auto pt-6 border-t border-[var(--color-border)]">
            <LogoutButton />
          </div>
        </aside>

        {/* Contenu principal — padding bottom sur mobile pour laisser place à la nav */}
        <main className="flex-1 p-6 pb-28 md:pb-6">{children}</main>
      </div>

      {/* Nav mobile flottante */}
      <AdminMobileNav />
    </div>
  );
}