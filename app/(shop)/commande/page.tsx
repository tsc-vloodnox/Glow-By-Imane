import { prisma } from "@/lib/prisma";
import CheckoutPageClient from "./CheckoutPageClient";

// Quartiers et tarifs rafraîchis au plus toutes les 5 min (et à chaque modification dans l'admin)
export const revalidate = 300;

export default async function CheckoutPage() {
  const [quartiers, pickupPoint] = await Promise.all([
    prisma.quartier.findMany({
      where: { active: true },
      orderBy: [{ position: "asc" }, { name: "asc" }],
      select: { id: true, name: true, commune: true, feeMin: true, feeMax: true },
    }),
    prisma.pickupPoint.findFirst({
      where: { isDefault: true, active: true },
      select: { name: true, address: true, lat: true, lng: true },
    }),
  ]);

  return <CheckoutPageClient quartiers={quartiers} pickupPoint={pickupPoint} />;
}
