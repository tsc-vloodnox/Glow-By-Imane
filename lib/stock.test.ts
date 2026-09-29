import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { releaseOrderStock, reserveOrderStock } from "./stock";

type Component = { productId: string; productSizeId: string | null; quantity: number };
type Item = {
  productId: string | null;
  productSizeId: string | null;
  quantity: number;
  components?: Component[];
  kit: { items: Component[] } | null;
};

/** Faux client de transaction : simule le drapeau stockReserved et enregistre les mouvements de stock. */
function fakeTx(items: Item[], reserved = true) {
  let stockReserved = reserved;
  const tx = {
    order: {
      // Bascule atomique : ne réussit que si le drapeau vaut la valeur attendue (where.stockReserved)
      updateMany: vi.fn(async ({ where }: { where: { stockReserved: boolean } }) => {
        if (stockReserved !== where.stockReserved) return { count: 0 };
        stockReserved = !stockReserved;
        return { count: 1 };
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
const decrementOf = (mock: ReturnType<typeof vi.fn>) =>
  mock.mock.calls.map(([args]) => [args.where.id, args.data.stock.decrement, args.where.stock]);

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

describe("reserveOrderStock (commande en gros confirmée)", () => {
  it("décrémente sans condition de disponibilité (le stock peut devenir négatif)", async () => {
    const tx = fakeTx(
      [
        { productId: "p1", productSizeId: null, quantity: 50, kit: null },
        { productId: "p2", productSizeId: "s1", quantity: 12, kit: null },
      ],
      false,
    );

    expect(await reserveOrderStock(tx, "order-1")).toBe(true);

    // Aucun filtre « stock >= quantité » : where.stock est absent
    expect(decrementOf(tx.product.updateMany)).toEqual([["p1", 50, undefined]]);
    expect(decrementOf(tx.productSize.updateMany)).toEqual([["s1", 12, undefined]]);
  });

  it("est idempotent : déjà réservé → rien ne bouge", async () => {
    const tx = fakeTx([{ productId: "p1", productSizeId: null, quantity: 5, kit: null }], true);

    expect(await reserveOrderStock(tx, "order-1")).toBe(false);
    expect(tx.product.updateMany).not.toHaveBeenCalled();
  });

  it("réserver puis annuler rend exactement ce qui a été pris", async () => {
    const tx = fakeTx([{ productId: "p1", productSizeId: null, quantity: 30, kit: null }], false);

    await reserveOrderStock(tx, "order-1");
    await releaseOrderStock(tx, "order-1");

    const calls = tx.product.updateMany.mock.calls as unknown as [{ where: { id: string }; data: { stock: object } }][];
    const movements = calls.map(([args]) => [args.where.id, args.data.stock]);
    expect(movements).toEqual([
      ["p1", { decrement: 30 }],
      ["p1", { increment: 30 }],
    ]);
  });
});
