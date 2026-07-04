import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { withDatabaseFallback } from "@/lib/db";
import { KitForm } from "../../KitForm";
import { requireAdmin } from "../../../actions";

export default async function EditKitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();

  const { id } = await params;

  const [kit, products] = await withDatabaseFallback(async () => {
    const [kitItem, productList] = await Promise.all([
      prisma.kit.findUnique({
        where: { id },
        include: {
          items: {
            select: { id: true, productId: true, productSizeId: true, quantity: true },
          },
        },
      }),
      prisma.product.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          price: true,
          archived: true,
          sizes: {
            where: { archived: false },
            orderBy: { position: "asc" },
            select: { id: true, label: true, price: true },
          },
        },
      }),
    ]);

    return [kitItem, productList] as const;
  }, [null, [] as Array<{ id: string; name: string; price: number; archived: boolean; sizes: { id: string; label: string; price: number }[] }>]);

  if (!kit) {
    return (
      <p className="text-sm text-[var(--color-muted)]">Kit introuvable.</p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Modifier le kit</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Mettez à jour la composition, le prix et les images.
          </p>
        </div>
        <Link href="/admin/kits" className="text-sm text-[var(--color-accent)]">
          Retour
        </Link>
      </div>

      <KitForm
        products={products}
        storageBaseUrl={process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL ?? ""}
        kit={{
          id: kit.id,
          name: kit.name,
          description: kit.description,
          price: kit.price,
          images: kit.images,
          items: kit.items,
        }}
      />
    </div>
  );
}
