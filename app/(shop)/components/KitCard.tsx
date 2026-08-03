// Destination : app/(shop)/components/KitCard.tsx
import Link from "next/link";

import type { KitWithItems } from "@/types/types";

function getCatalogPath(imageName: string) {
  if (imageName.startsWith("/")) return imageName;
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const encodedName = encodeURIComponent(imageName);
  return supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/public/catalogue/${encodedName}`
    : `/catalogue/${encodedName}`;
}

/** Stock disponible pour un kit = le plus petit "stock article / quantité requise" parmi ses items. */
export function computeKitStock(kit: KitWithItems) {
  return kit.items.reduce((min, item) => {
    const available = item.productSize ? item.productSize.stock : item.product.stock;
    return Math.min(min, Math.floor(available / item.quantity));
  }, Infinity);
}

export function KitCard({ kit }: { kit: KitWithItems }) {
  const stock = Math.max(computeKitStock(kit), 0);
  const stockLabel = stock <= 0 ? "Rupture" : stock <= 3 ? `Plus que ${stock}` : "En stock";
  const stockTone = stock <= 0 ? "text-red-500" : stock <= 3 ? "text-amber-600" : "text-[var(--color-muted)]";
  const coverImage = kit.images[0];

  return (
    <Link
      href={`/kits/${kit.id}`}
      className="product-card flex flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white"
      style={{ boxShadow: "0 4px 20px rgba(139,26,58,0.05)" }}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-[var(--color-blush)]">
        {coverImage ? (
          <img src={getCatalogPath(coverImage)} alt={kit.name} className="h-full w-full object-cover" />
        ) : null}
        <span className="absolute left-2 top-2 rounded-full bg-[var(--color-gold)] px-2 py-0.5 text-[9px] font-medium text-white">
          Kit
        </span>
      </div>
      <div className="flex flex-col gap-1 p-3">
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-gold)]">
          {kit.items.length} article{kit.items.length > 1 ? "s" : ""}
        </span>
        <h3 className="text-sm font-semibold leading-snug text-[var(--color-foreground)]">{kit.name}</h3>
        {kit.description ? (
          <p className="text-[11px] leading-snug text-[var(--color-muted)] line-clamp-2">{kit.description}</p>
        ) : null}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--color-accent)]">
            {kit.price.toLocaleString("fr-GN")} GNF
          </span>
          <span className={`text-[10px] ${stockTone}`}>{stockLabel}</span>
        </div>
      </div>
    </Link>
  );
}