import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../actions";
import { LivraisonsBoard } from "./LivraisonsBoard";

export default async function AdminLivraisonsPage() {
  await requireAdmin();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [deliveries, livreurs, toPlan] = await Promise.all([
    // Livraisons non livrées + celles livrées aujourd'hui
    prisma.delivery.findMany({
      where: {
        order: { status: { not: "ANNULEE" } },
        OR: [
          { status: { not: "LIVREE" } },
          { status: "LIVREE", deliveredAt: { gte: today } },
        ],
      },
      orderBy: { scheduledAt: "asc" },
      include: {
        livreur: { select: { id: true, name: true } },
        run: { select: { settledAt: true } },
        order: {
          select: {
            id: true,
            number: true,
            name: true,
            phone: true,
            quartier: true,
            finalTotal: true,
            depositAmount: true,
            quartierRef: { select: { name: true } },
          },
        },
      },
    }),
    prisma.livreur.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // Commandes confirmées à livrer, sans livraison planifiée
    prisma.order.findMany({
      where: {
        deliveryMode: "LIVRAISON",
        delivery: null,
        status: { in: ["DISCUSSION_WHATSAPP", "CONFIRMEE", "PREPARATION", "EN_LIVRAISON"] },
      },
      orderBy: { createdAt: "asc" },
      take: 100,
      select: {
        id: true,
        number: true,
        name: true,
        status: true,
        quartier: true,
        deliveryFeeMin: true,
        deliveryFeeMax: true,
        quartierRef: { select: { name: true } },
      },
    }),
  ]);

  return (
    <LivraisonsBoard
      deliveries={deliveries.map((d) => ({
        id: d.id,
        scheduledAt: d.scheduledAt,
        status: d.status,
        notes: d.notes,
        deliveryFee: d.deliveryFee,
        livreurId: d.livreurId,
        livreur: d.livreur,
        runId: d.runId,
        runSettled: d.run?.settledAt != null,
        order: {
          id: d.order.id,
          number: d.order.number,
          name: d.order.name,
          phone: d.order.phone,
          address: d.order.quartier,
          zone: d.order.quartierRef?.name ?? d.order.quartier,
          finalTotal: d.order.finalTotal,
          depositAmount: d.order.depositAmount,
        },
      }))}
      livreurs={livreurs}
      toPlan={toPlan.map((o) => ({
        id: o.id,
        number: o.number,
        name: o.name,
        status: o.status,
        address: o.quartier,
        zone: o.quartierRef?.name ?? o.quartier,
        feeMin: o.deliveryFeeMin,
        feeMax: o.deliveryFeeMax,
      }))}
    />
  );
}
