import type { Metadata } from "next";

import { prisma } from "@/lib/prisma";
import { WHOLESALE_MIN_TOTAL_QUANTITY } from "@/lib/wholesale";
import { WholesaleRequestClient, type WholesaleProduct } from "./WholesaleRequestClient";

export const metadata: Metadata = {
  title: "Espace revendeurs",
  description: "Commandes en gros pour les revendeurs : prix dégressifs, disponibilité et tarifs confirmés sur WhatsApp.",
  alternates: { canonical: "/revendeur" },
};

// Prix et promotions rafraîchis au plus toutes les 60 s
export const revalidate = 60;

export default async function RevendeurPage() {
  const now = new Date();
  const products = await prisma.product.findMany({
    where: { archived: false },
    orderBy: [{ category: { name: "asc" } }, { name: "asc" }],
    include: {
      category: { select: { name: true } },
      sizes: { where: { archived: false }, orderBy: { position: "asc" } },
      packPrices: true,
      promotions: {
        where: { promotion: { active: true, startAt: { lte: now }, endAt: { gte: now } } },
        include: { promotion: { select: { discountPercent: true } } },
      },
    },
  });

  const catalogue: WholesaleProduct[] = products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category.name,
    image: product.images[0] ?? null,
    price: product.price,
    originalPrice: product.originalPrice,
    activePromotions: product.promotions.map((pp) => ({ discountPercent: pp.promotion.discountPercent })),
    sizes: product.sizes.map((size) => ({ id: size.id, label: size.label, price: size.price })),
    packPrices: product.packPrices.map((pack) => ({
      quantity: pack.quantity,
      price: pack.price,
      productSizeId: pack.productSizeId,
    })),
  }));

  return <WholesaleRequestClient products={catalogue} minQuantity={WHOLESALE_MIN_TOTAL_QUANTITY} />;
}
