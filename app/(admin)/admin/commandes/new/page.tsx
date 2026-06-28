import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../../actions";
import { AdminOrderForm } from "./AdminOrderForm";

export default async function NewAdminOrderPage() {
  await requireAdmin();

  const products = await prisma.product.findMany({
    where: { archived: false },
    orderBy: [{ categoryId: "asc" }, { name: "asc" }],
    select: { id: true, name: true, price: true, categoryId: true },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/commandes" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]">
            ← Commandes
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Nouvelle commande</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Saisie manuelle — pour les commandes WhatsApp ou hors-application.
          </p>
        </div>
      </div>

      <AdminOrderForm products={products} />
    </div>
  );
}
