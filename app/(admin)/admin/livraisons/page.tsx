import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../actions";
import { LivraisonsBoard } from "./LivraisonsBoard";

export default async function AdminLivraisonsPage() {
  await requireAdmin();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [deliveries, livreurs] = await Promise.all([
    // Livraisons non livrées + celles livrées aujourd'hui
    prisma.delivery.findMany({
      where: {
        OR: [
          { status: { not: "LIVREE" } },
          { status: "LIVREE", deliveredAt: { gte: today } },
        ],
      },
      orderBy: { scheduledAt: "asc" },
      include: {
        livreur: { select: { id: true, name: true } },
        order: {
          select: {
            id: true,
            number: true,
            name: true,
            phone: true,
            quartier: true,
            finalTotal: true,
          },
        },
      },
    }),
    prisma.livreur.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return <LivraisonsBoard initialDeliveries={deliveries} initialLivreurs={livreurs} />;
}
