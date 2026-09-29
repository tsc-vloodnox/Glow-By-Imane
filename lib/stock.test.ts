import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { releaseOrderStock } from "./stock";

type Component = { productId: string; productSizeId: string | null; quantity: number };
type Item = {
  productId: string | null;
  productSizeId: string | null;
  quantity: number;
  components?: Component[];
  kit: { items: Component[] } | null;
};

/** Faux client de transaction : simule le drapeau stockReserved et enregistre les restitutions. */
function fakeTx(items: Item[], reserved = true) {
  let stockReserved = reserved;
  const tx = {
    order: {
      updateMany: vi.fn(async () => {
        const count = stockReserved ? 1 : 0;
        stockReserved = false;
        return { count };
      }),
    },
    orderItem: { findMany: vi.fn(async () => items.map((i) => ({ components: [], ...i }))) },
    product: { updateMany: vi.fn(async () => ({ count: 1 })) },
    productSize: { updateMany: vi.fn(async () => ({ count: 1 })) },
  };
  return tx as typeof tx & Prisma.TransactionClient;
}

const incrementOf = (mock: ReturnType<typeof vi.fn>) =>
  mock.mock.calls.map(([args]) => [args.where.id, args.data.stock.increment]);

describe("releaseOrderStock", () => {
  it("restitue produits, tailles et composants de kit", async () => {
    const tx = fakeTx([
      { productId: "p1", productSizeId: null, quantity: 2, kit: null },
      { productId: "p2", productSizeId: "s1", quantity: 3, kit: null },
      {
        productId: null,
        productSizeId: null,
        quantity: 2,
        kit: {
          items: [
            { productId: "p3", productSizeId: null, quantity: 1 },
            { productId: "p4", productSizeId: "s2", quantity: 2 },
          ],
        },
      },
    ]);

    await releaseOrderStock(tx, "order-1");

    expect(incrementOf(tx.product.updateMany)).toEqual([
      ["p1", 2],
      ["p3", 2], // 1 par kit × 2 kits
    ]);
    expect(incrementOf(tx.productSize.updateMany)).toEqual([
      ["s1", 3],
      ["s2", 4], // 2 par kit × 2 kits
    ]);
  });

  it("kit : restitue le contenu figé à la commande, pas la composition actuelle", async () => {
    const tx = fakeTx([
      {
        productId: null,
        productSizeId: null,
        quantity: 3,
        // Contenu vendu : 2 × p1 par kit
        components: [{ productId: "p1", productSizeId: null, quantity: 2 }],
        // Kit modifié depuis : contient désormais p9
        kit: { items: [{ productId: "p9", productSizeId: null, quantity: 1 }] },
      },
    ]);

    await releaseOrderStock(tx, "order-1");

    expect(incrementOf(tx.product.updateMany)).toEqual([["p1", 6]]);
  });

  it("est idempotent : un second appel ne restitue rien", async () => {
    const tx = fakeTx([{ productId: "p1", productSizeId: null, quantity: 1, kit: null }]);

    await releaseOrderStock(tx, "order-1");
    await releaseOrderStock(tx, "order-1");

    expect(tx.product.updateMany).toHaveBeenCalledTimes(1);
  });

  it("ne fait rien si la commande ne réservait pas de stock", async () => {
    const tx = fakeTx([{ productId: "p1", productSizeId: null, quantity: 1, kit: null }], false);

    await releaseOrderStock(tx, "order-1");

    expect(tx.orderItem.findMany).not.toHaveBeenCalled();
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });
});
