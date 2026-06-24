import type { Order, OrderItem, Product } from "@prisma/client";

export type CartItemInput = {
  productId: string;
  quantity: number;
};

export type OrderInput = {
  name: string;
  phone: string;
  quartier: string;
  comment?: string;
  items: CartItemInput[];
};

export type OrderWithItems = Order & {
  items: (OrderItem & { product: Product })[];
};

export type ProductPageParams = {
  slug: string;
};

export type ProductPageProps = {
  params: Promise<ProductPageParams>;
};
