// Destination : app/(shop)/components/CartFloatingButton.tsx
"use client";

import Link from "next/link";

import { useCart } from "../CartContext";

export function CartFloatingButton() {
  const { count } = useCart();

  if (count === 0) {
    return null;
  }

  return (
    <Link
      href="/panier"
      className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-[var(--color-accent)] px-5 py-3 text-white shadow-[0_10px_28px_rgba(107,31,42,0.3)]"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 3h2l.4 2M7 13h10l3-7H6.4M7 13 5.4 5M7 13l-1.5 4h11" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9" cy="20" r="1" />
        <circle cx="17" cy="20" r="1" />
      </svg>
      <span className="text-sm font-medium">Panier ({count})</span>
    </Link>
  );
}
