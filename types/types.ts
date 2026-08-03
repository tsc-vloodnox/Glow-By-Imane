import type {
  Category,
  Customer,
  Delivery,
  GiftCard,
  Kit,
  KitItem,
  Order,
  OrderItem,
  Product,
  ProductPackPrice,
  ProductSize,
} from "@prisma/client";

// ─── Panier / commande entrante (catalogue public) ───────────────────────────

export type CartItemInput =
  | { kind: "product"; productId: string; productSizeId?: string | null; quantity: number }
  | { kind: "kit"; kitId: string; quantity: number };

export type GiftInput = {
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  message?: string;
  photo?: string;
  printRequested?: boolean;
};

export type OrderInput = {
  name: string;
  phone: string;
  quartier: string;
  comment?: string;
  items: CartItemInput[];
  gift?: GiftInput;
};

// ─── Statuts ─────────────────────────────────────────────────────────────────

export type OrderStatus =
  | "NOUVELLE"
  | "DISCUSSION_WHATSAPP"
  | "CONFIRMEE"
  | "PREPARATION"
  | "EN_LIVRAISON"
  | "LIVREE"
  | "ANNULEE";

export type DeliveryStatus = "PLANIFIEE" | "EN_COURS" | "LIVREE" | "ECHOUEE" | "REPORTEE";

// ─── Compositions Prisma — commandes ─────────────────────────────────────────

/** Un OrderItem référence soit un produit (avec taille optionnelle), soit un kit — jamais les deux.
 *  NB : nécessite la migration rendant OrderItem.productId optionnel (cf. schema.prisma). */
export type OrderItemWithProduct = OrderItem & {
  product: Pick<Product, "id" | "name"> | null;
  productSize: Pick<ProductSize, "id" | "label"> | null;
  kit: Pick<Kit, "id" | "name"> | null;
};

export type OrderWithItems = Order & { items: OrderItemWithProduct[] };

export type OrderWithDetails = Order & {
  items: OrderItemWithProduct[];
  delivery: Delivery | null;
  customer: Customer | null;
  giftCard: GiftCard | null;
};

export type OrderListRow = Order & {
  items: OrderItemWithProduct[];
  delivery: Pick<Delivery, "status" | "scheduledAt"> | null;
};

// ─── Compositions Prisma — livraisons ────────────────────────────────────────

export type DeliveryWithOrder = Delivery & {
  order: Pick<Order, "id" | "number" | "name" | "phone" | "quartier" | "estimatedTotal">;
};

// ─── Compositions Prisma — produits ──────────────────────────────────────────

export type ProductWithCategory = Product & { category: Pick<Category, "id" | "name"> };

export type ProductAdminRow = Product & {
  category: Pick<Category, "id" | "name">;
  _count: { orderItems: number };
};

/** Produit avec catégorie, tailles et paliers — ProductCard, fiche produit, ShopPageClient */
export type ProductWithPricing = Product & {
  category: Pick<Category, "id" | "name">;
  sizes: ProductSize[];
  packPrices: ProductPackPrice[];
};

// ─── Compositions Prisma — kits ──────────────────────────────────────────────

export type KitWithItems = Kit & {
  items: (KitItem & {
    product: Pick<Product, "id" | "name" | "stock">;
    productSize: Pick<ProductSize, "id" | "label" | "stock"> | null;
  })[];
};

// ─── Params de pages Next.js ─────────────────────────────────────────────────

export type ProductPageParams = { slug: string };
export type ProductPageProps = { params: Promise<ProductPageParams> };

export type OrderDetailParams = { id: string };
export type OrderDetailProps = { params: Promise<OrderDetailParams> };