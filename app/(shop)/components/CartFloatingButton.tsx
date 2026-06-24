"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getCartCount } from "@/lib/cart";

export function CartFloatingButton() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const syncCount = () => setCount(getCartCount());

    syncCount();
    window.addEventListener("glow-cart-updated", syncCount);
    window.addEventListener("focus", syncCount);

    return () => {
      window.removeEventListener("glow-cart-updated", syncCount);
      window.removeEventListener("focus", syncCount);
    };
  }, []);

  return (
    <Link
      href="/panier"
      className="fixed bottom-5 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-accent)] text-white shadow-[0_12px_30px_rgba(107,31,42,0.28)] transition-transform active:scale-95"
      aria-label={`Panier${count > 0 ? `, ${count} article${count > 1 ? "s" : ""}` : ""}`}
    >
      <span aria-hidden="true" className="text-xl">
        🛒
      </span>
      {count > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--color-whatsapp)] px-1 text-[10px] font-semibold text-white">
          {count}
        </span>
      ) : null}
    </Link>
  );
}
