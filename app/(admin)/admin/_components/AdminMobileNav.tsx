// Destination : app/admin/_components/AdminMobileNav.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    href: "/admin/dashboard",
    label: "Dashboard",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M2 10a8 8 0 1 1 16 0A8 8 0 0 1 2 10Zm8-3a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm-1 4a1 1 0 0 1 2 0v3a1 1 0 1 1-2 0v-3Z" />
      </svg>
    ),
  },
  {
    href: "/admin/commandes",
    label: "Commandes",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path
          fillRule="evenodd"
          d="M6 2a1 1 0 0 0-1 1v1H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-1V3a1 1 0 1 0-2 0v1H7V3a1 1 0 0 0-1-1Zm0 5a1 1 0 0 0 0 2h8a1 1 0 1 0 0-2H6Z"
          clipRule="evenodd"
        />
      </svg>
    ),
  },
  {
    href: "/admin/produits",
    label: "Produits",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M3.75 3A1.75 1.75 0 0 0 2 4.75v3.5C2 9.216 2.784 10 3.75 10h3.5A1.75 1.75 0 0 0 9 8.25v-3.5A1.75 1.75 0 0 0 7.25 3h-3.5ZM3.75 11A1.75 1.75 0 0 0 2 12.75v3.5c0 .966.784 1.75 1.75 1.75h3.5A1.75 1.75 0 0 0 9 16.25v-3.5A1.75 1.75 0 0 0 7.25 11h-3.5ZM11 4.75A1.75 1.75 0 0 1 12.75 3h3.5A1.75 1.75 0 0 1 18 4.75v3.5A1.75 1.75 0 0 1 16.25 10h-3.5A1.75 1.75 0 0 1 11 8.25v-3.5ZM12.75 11A1.75 1.75 0 0 0 11 12.75v3.5c0 .966.784 1.75 1.75 1.75h3.5A1.75 1.75 0 0 0 18 16.25v-3.5A1.75 1.75 0 0 0 16.25 11h-3.5Z" />
      </svg>
    ),
  },
  {
    href: "/admin/livraisons",
    label: "Livraisons",
    icon: (
      <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
        <path d="M6.5 3c-1.051 0-2.093.04-3.125.117A1.49 1.49 0 0 0 2 4.607V10.5h9V4.606c0-.771-.59-1.43-1.375-1.489A41.568 41.568 0 0 0 6.5 3ZM2 12v2.5A1.5 1.5 0 0 0 3.5 16h.041a3 3 0 0 1 5.918 0h.791a.75.75 0 0 0 .75-.75V12H2Z" />
        <path d="M6.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM13.25 5a.75.75 0 0 0-.75.75v8.514a3.001 3.001 0 0 1 4.893 1.44c.37-.275.607-.714.607-1.204v-1a3 3 0 0 0-3-3h-1V5.75a.75.75 0 0 0-.75-.75ZM14.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
      </svg>
    ),
  },
];

export function AdminMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 pb-safe">
      {/* Fond avec blur */}
      <div className="mx-3 mb-3 rounded-2xl bg-white/90 backdrop-blur-md border border-[var(--color-border)] shadow-[0_-2px_24px_rgba(139,26,58,0.08)]">
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex flex-col items-center gap-1 min-w-[56px] py-1 relative"
              >
                {/* Pill de fond sur l'item actif */}
                <span
                  className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                    isActive ? "bg-[var(--color-accent)]/10 scale-100" : "scale-75 opacity-0"
                  }`}
                />
                {/* Icône */}
                <span
                  className={`relative transition-colors duration-200 ${
                    isActive ? "text-[var(--color-accent)]" : "text-[var(--color-muted)]"
                  }`}
                >
                  {item.icon}
                </span>
                {/* Label */}
                <span
                  className={`relative text-[10px] font-medium transition-colors duration-200 leading-none ${
                    isActive ? "text-[var(--color-accent)]" : "text-[var(--color-muted)]"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}