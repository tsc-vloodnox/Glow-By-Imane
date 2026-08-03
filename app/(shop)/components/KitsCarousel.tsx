// Destination : app/(shop)/components/KitsCarousel.tsx
import Link from "next/link";

import { computeKitStock } from "./KitCard";
import type { KitWithItems } from "@/types/types";

function getCatalogPath(imageName: string) {
  if (imageName.startsWith("/")) return imageName;
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const encodedName = encodeURIComponent(imageName);
  return supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/public/catalogue/${encodedName}`
    : `/catalogue/${encodedName}`;
}

export function KitsCarousel({ kits }: { kits: KitWithItems[] }) {
  if (kits.length === 0) return null;

  return (
    <section className="mt-8 px-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="font-serif text-xl text-[var(--color-accent)]">Nos kits</h2>
        <Link href="/kits" className="text-[11px] text-[var(--color-muted)]">
          Tout voir
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {kits.map((kit) => {
          const stock = Math.max(computeKitStock(kit), 0);
          const coverImage = kit.images[0];
          return (
            <Link
              key={kit.id}
              href={`/kits/${kit.id}`}
              className="w-[150px] flex-none overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white"
              style={{ boxShadow: "0 4px 20px rgba(139,26,58,0.05)" }}
            >
              <div className="relative aspect-square overflow-hidden bg-[var(--color-blush)]">
                {coverImage ? (
                  <img src={getCatalogPath(coverImage)} alt={kit.name} className="h-full w-full object-cover" />
                ) : null}
                <span className="absolute left-2 top-2 rounded-full bg-[var(--color-gold)] px-2 py-0.5 text-[8px] font-medium text-white">
                  Kit
                </span>
              </div>
              <div className="p-2">
                <h3 className="line-clamp-1 text-xs font-semibold text-[var(--color-foreground)]">{kit.name}</h3>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--color-accent)]">
                    {kit.price.toLocaleString("fr-GN")} GNF
                  </span>
                  {stock <= 0 ? <span className="text-[9px] text-red-500">Rupture</span> : null}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}