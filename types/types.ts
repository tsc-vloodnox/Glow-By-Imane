import type {
  Category,
  Customer,
  Delivery,
  Order,
  OrderItem,
  Product,
} from "@prisma/client";

// ─── Panier / commande entrante (catalogue public) ───────────────────────────

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

// ─── Statuts ─────────────────────────────────────────────────────────────────

export type OrderStatus =
  | "NOUVELLE"
  | "DISCUSSION_WHATSAPP"
  | "CONFIRMEE"
  | "PREPARATION"
  | "EN_LIVRAISON"
  | "LIVREE"
  | "ANNULEE";

export type DeliveryStatus =
  | "PLANIFIEE"
  | "EN_COURS"
  | "LIVREE"
  | "ECHOUEE"
  | "REPORTEE";

// ─── Compositions Prisma — commandes ─────────────────────────────────────────

/** Article avec produit complet */
export type OrderItemWithProduct = OrderItem & {
  product: Product;
};

/** Article avec produit minimal (nom uniquement) */
export type OrderItemWithProductName = OrderItem & {
  product: Pick<Product, "id" | "name">;
};

/** Commande avec ses articles et produits complets */
export type OrderWithItems = Order & {
  items: OrderItemWithProduct[];
};

/** Commande avec articles (nom produit) + livraison + client */
export type OrderWithDetails = Order & {
  items: OrderItemWithProductName[];
  delivery: Delivery | null;
  customer: Customer | null;
};

/** Commande avec articles (nom produit) + livraison partielle — pour la liste admin */
export type OrderListRow = Order & {
  items: OrderItemWithProductName[];
  delivery: Pick<Delivery, "status" | "scheduledAt"> | null;
};

// ─── Compositions Prisma — livraisons ────────────────────────────────────────

/** Livraison avec infos commande pour la vue calendrier */
export type DeliveryWithOrder = Delivery & {
  order: Pick<Order, "id" | "number" | "name" | "phone" | "quartier" | "estimatedTotal">;
};

// ─── Compositions Prisma — produits ──────────────────────────────────────────

/** Produit avec sa catégorie et le compteur de commandes associées */
export type ProductWithCategory = Product & {
  category: Pick<Category, "id" | "name">;
};

export type ProductAdminRow = Product & {
  category: Pick<Category, "id" | "name">;
  _count: { orderItems: number };
};

// ─── Params de pages Next.js ─────────────────────────────────────────────────

export type ProductPageParams = { slug: string };
export type ProductPageProps = { params: Promise<ProductPageParams> };

export type OrderDetailParams = { id: string };
export type OrderDetailProps = { params: Promise<OrderDetailParams> };
