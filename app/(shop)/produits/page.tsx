import Link from "next/link";

import { prisma } from "@/lib/prisma";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const products = await prisma.product.findMany({
    where: category && category !== "all" ? { categoryId: category } : undefined,
    include: { category: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const catalogPath = (imageName: string) => {
    if (imageName.startsWith("/")) {
      return imageName;
    }

    const encodedName = encodeURIComponent(imageName);
    return supabaseUrl
      ? `${supabaseUrl}/storage/v1/object/public/catalogue/${encodedName}`
      : `/catalogue/${encodedName}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-[var(--color-foreground)]">Produits</h1>
          <p className="mt-1 text-sm text-[var(--color-muted)]">Découvrez toute la collection disponible.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/produits"
          className={`rounded-full px-4 py-2 text-sm ${!category || category === "all" ? "bg-[var(--color-accent)] text-white" : "border border-[var(--color-border)] bg-white text-[var(--color-accent)]"}`}
        >
          Tous
        </Link>
        {categories.map((item) => (
          <Link
            key={item.id}
            href={`/produits?category=${item.id}`}
            className={`rounded-full px-4 py-2 text-sm ${category === item.id ? "bg-[var(--color-accent)] text-white" : "border border-[var(--color-border)] bg-white text-[var(--color-accent)]"}`}
          >
            {item.name}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/produits/${product.id}`}
            className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-white"
          >
            <div className="aspect-[4/5] bg-[var(--color-sand)]">
              {product.images.length > 0 ? (
                <img src={catalogPath(product.images[0])} alt={product.name} className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="p-3">
              <p className="text-[10px] uppercase tracking-wider text-[var(--color-gold)]">{product.category.name}</p>
              <h2 className="mt-1 text-sm font-semibold text-[var(--color-foreground)]">{product.name}</h2>
              <p className="mt-1 text-[11px] text-[var(--color-muted)]">{product.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-[var(--color-accent)]">
                  {product.price.toLocaleString("fr-GN")} GNF
                </span>
                <span className="text-[10px] text-[var(--color-muted)]">
                  {product.stock > 0 ? "En stock" : "Rupture"}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
