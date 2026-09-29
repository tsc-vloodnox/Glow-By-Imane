// Destination : lib/customer-stats.ts
// Statistiques par cliente (hors commandes annulées), pour les pages admin Clientes.

import { prisma } from "@/lib/prisma";

export type CustomerStats = { orderCount: number; totalSpent: number; lastOrderAt: Date | null };

export async function getCustomerStats(customerIds?: string[]): Promise<Map<string, CustomerStats>> {
  const rows = await prisma.order.groupBy({
    by: ["customerId"],
    where: {
      status: { not: "ANNULEE" },
      customerId: customerIds ? { in: customerIds } : { not: null },
    },
    _count: { _all: true },
    _sum: { finalTotal: true },
    _max: { createdAt: true },
  });

  return new Map(
    rows
      .filter((row) => row.customerId)
      .map((row) => [
        row.customerId as string,
        {
          orderCount: row._count._all,
          totalSpent: row._sum.finalTotal ?? 0,
          lastOrderAt: row._max.createdAt,
        },
      ]),
  );
}
