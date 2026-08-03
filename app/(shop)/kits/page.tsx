// Destination : app/(shop)/kits/page.tsx
import Link from "next/link";

import { KitCard } from "../components/KitCard";
import { prisma } from "@/lib/prisma";

export default async function KitsPage() {
  const kits = await prisma.kit.findMany({
    where: { archived: false },
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, stock: true } },
          productSize: { select: { id: true, label: true, stock: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="min-h-screen bg-[var(--color-cream)] text-[var(--foreground)]">
      <header className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-cream)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="rounded-full p-2 text-[var(--color-accent)] transition hover:bg-[var(--color-blush)]">
            <span aria-hidden="true">←</span>
          </Link>
          <h1 className="text-lg font-semibold italic text-[var(--color-accent)]">Nos kits</h1>
          <Link href="/panier" className="rounded-full p-2 text-[var(--color-accent)] transition hover:bg-[var(--color-blush)]">
            <span aria-hidden="true">🛒</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        {kits.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] p-8 text-center text-[var(--color-muted)]">
            Aucun kit disponible pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {kits.map((kit) => (
              <KitCard key={kit.id} kit={kit} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}