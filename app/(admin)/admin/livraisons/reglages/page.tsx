import Link from "next/link";

import { getDeliverySettings } from "@/lib/delivery-settings";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../../actions";
import { DeliverySettingsClient } from "./DeliverySettingsClient";

export default async function DeliverySettingsPage() {
  await requireAdmin();

  const [pickupPoint, quartiers, settings] = await Promise.all([
    prisma.pickupPoint.upsert({
      where: { id: "pp_boutique" },
      create: { id: "pp_boutique", name: "Boutique Glow by Imane", isDefault: true },
      update: {},
    }),
    prisma.quartier.findMany({
      orderBy: [{ position: "asc" }, { name: "asc" }],
      include: { _count: { select: { orders: true } } },
    }),
    getDeliverySettings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/livraisons" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]">
          ← Livraisons
        </Link>
        <h1 className="mt-1 text-2xl font-semibold">Zones & tarifs</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Quartiers et fourchettes affichées aux clientes, boutique (départ et retrait), tarif des tournées des livreurs.
        </p>
      </div>
      <DeliverySettingsClient
        pickupPoint={{ id: pickupPoint.id, name: pickupPoint.name, address: pickupPoint.address, lat: pickupPoint.lat, lng: pickupPoint.lng }}
        quartiers={quartiers.map((q) => ({
          id: q.id, name: q.name, commune: q.commune, lat: q.lat, lng: q.lng, feeMin: q.feeMin, feeMax: q.feeMax, active: q.active,
          orderCount: q._count.orders,
        }))}
        settings={settings}
      />
    </div>
  );
}
