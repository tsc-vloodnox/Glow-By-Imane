import { prisma } from "@/lib/prisma";
import { withDatabaseFallback } from "@/lib/db";

const statusLabels: Record<string, string> = {
  NOUVELLE: "Nouvelle",
  DISCUSSION_WHATSAPP: "Discussion WhatsApp",
  CONFIRMEE: "Confirmée",
  PREPARATION: "Préparation",
  EN_LIVRAISON: "En livraison",
  LIVREE: "Livrée",
  ANNULEE: "Annulée",
};

export default async function AdminOrdersPage() {
  const orders = await withDatabaseFallback(
    () =>
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        include: { items: { include: { product: true } } },
      }),
    [],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Commandes</h1>
        <p className="text-sm text-[var(--color-muted)]">
          {orders.length} commande{orders.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
        {orders.length === 0 ? (
          <p className="p-6 text-sm text-[var(--color-muted)]">Aucune commande.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-sand)]">
              <tr>
                <th className="p-4 font-medium">#</th>
                <th className="p-4 font-medium">Client</th>
                <th className="p-4 font-medium">Quartier</th>
                <th className="p-4 font-medium">Total</th>
                <th className="p-4 font-medium">Statut</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-[var(--color-border)]">
                  <td className="p-4">{order.number}</td>
                  <td className="p-4">
                    <p>{order.name}</p>
                    <p className="text-[var(--color-muted)]">{order.phone}</p>
                  </td>
                  <td className="p-4">{order.quartier}</td>
                  <td className="p-4">
                    {order.estimatedTotal.toLocaleString("fr-GN")} GNF
                  </td>
                  <td className="p-4">
                    <span className="rounded-full bg-[var(--color-blush)] px-3 py-1 text-xs">
                      {statusLabels[order.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
