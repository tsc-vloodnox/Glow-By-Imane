import Link from "next/link";

import { CartFloatingButton } from "./components/CartFloatingButton";

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 pb-6 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <Link href="/" className="font-serif text-xl text-[var(--color-accent)]">
          Glow by Imane
        </Link>
        <Link
          href={`https://wa.me/${process.env.WHATSAPP_VENDOR_NUMBER ?? ""}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-[#25D366] px-4 py-2 text-sm font-medium text-white"
        >
          WhatsApp
        </Link>
      </header>

      <nav className="mb-6 flex items-center gap-3 text-sm text-[var(--color-muted)]">
        <Link href="/" className="rounded-full px-3 py-1.5 transition hover:bg-[var(--color-blush)] hover:text-[var(--color-accent)]">
          Accueil
        </Link>
        <Link href="/produits" className="rounded-full px-3 py-1.5 transition hover:bg-[var(--color-blush)] hover:text-[var(--color-accent)]">
          Produits
        </Link>
        <Link href="/panier" className="rounded-full px-3 py-1.5 transition hover:bg-[var(--color-blush)] hover:text-[var(--color-accent)]">
          Panier
        </Link>
      </nav>

      <main className="flex-1">{children}</main>

      <CartFloatingButton />
    </div>
  );
}
