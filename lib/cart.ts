import { resolveDiscountedLineTotal, type ActivePromotion, type PackPriceRule } from "./pricing";

export type CartItem = {
  cartKey: string; // productId | "productId:sizeId" | "kit:kitId"
  kind: "product" | "kit";
  productId: string | null;
  productSizeId: string | null;
  kitId: string | null;
  name: string;
  sizeLabel: string | null;
  basePrice: number; // prix net (remise permanente déjà appliquée), à quantité 1
  originalPrice: number | null; // prix avant remise permanente — référence des promos (null pour tailles et kits)
  activePromotions: ActivePromotion[]; // promotions temporaires actives, connues au moment de l'ajout
  packPrices: PackPriceRule[]; // vide pour un kit
  quantity: number;
  stock: number; // taille choisie, ou min du kit, connu au moment de l'ajout
};

const CART_STORAGE_KEY = "glow-cart-items";
const FALLBACK_STOCK = 99;

export function makeProductCartKey(productId: string, productSizeId?: string | null) {
  return productSizeId ? `${productId}:${productSizeId}` : productId;
}

export function makeKitCartKey(kitId: string) {
  return `kit:${kitId}`;
}

export function getStoredCartItems(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Partial<CartItem & { price: number }>[];
    if (!Array.isArray(parsed)) return [];

    // Compatibilité paniers pré-tailles/kits/promotions (anciens items : productId/name/price/quantity/stock)
    return parsed
      .filter((item) => item && (item.productId || item.kitId))
      .map((item) => ({
        cartKey:
          item.cartKey ??
          (item.kitId
            ? makeKitCartKey(item.kitId)
            : makeProductCartKey(item.productId as string, item.productSizeId ?? null)),
        kind: item.kind ?? (item.kitId ? "kit" : "product"),
        productId: item.productId ?? null,
        productSizeId: item.productSizeId ?? null,
        kitId: item.kitId ?? null,
        name: item.name ?? "",
        sizeLabel: item.sizeLabel ?? null,
        basePrice: item.basePrice ?? item.price ?? 0,
        originalPrice: item.originalPrice ?? null,
        activePromotions: item.activePromotions ?? [],
        packPrices: item.packPrices ?? [],
        quantity: item.quantity ?? 1,
        stock: typeof item.stock === "number" ? item.stock : FALLBACK_STOCK,
      }));
  } catch {
    return [];
  }
}

function emitCartUpdated() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("glow-cart-updated"));
}

export function setStoredCartItems(items: CartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  emitCartUpdated();
}

type AddProductInput = {
  kind: "product";
  productId: string;
  productSizeId?: string | null;
  sizeLabel?: string | null;
  name: string;
  basePrice: number;
  originalPrice?: number | null;
  activePromotions?: ActivePromotion[];
  packPrices?: PackPriceRule[];
  stock: number;
};

type AddKitInput = {
  kind: "kit";
  kitId: string;
  name: string;
  basePrice: number;
  activePromotions?: ActivePromotion[];
  stock: number;
};

export function addToCart(input: AddProductInput | AddKitInput, quantity = 1) {
  const items = getStoredCartItems();
  const cartKey =
    input.kind === "kit" ? makeKitCartKey(input.kitId) : makeProductCartKey(input.productId, input.productSizeId);

  const existing = items.find((item) => item.cartKey === cartKey);

  const nextItems = existing
    ? items.map((item) =>
        item.cartKey === cartKey
          ? {
              ...item,
              stock: input.stock,
              basePrice: input.basePrice,
              originalPrice: input.kind === "product" ? input.originalPrice ?? null : null,
              activePromotions: input.activePromotions ?? item.activePromotions,
              quantity: clamp(item.quantity + quantity, input.stock),
            }
          : item,
      )
    : [
        ...items,
        input.kind === "kit"
          ? {
              cartKey,
              kind: "kit" as const,
              productId: null,
              productSizeId: null,
              kitId: input.kitId,
              name: input.name,
              sizeLabel: null,
              basePrice: input.basePrice,
              originalPrice: null,
              activePromotions: input.activePromotions ?? [],
              packPrices: [],
              quantity: clamp(quantity, input.stock),
              stock: input.stock,
            }
          : {
              cartKey,
              kind: "product" as const,
              productId: input.productId,
              productSizeId: input.productSizeId ?? null,
              kitId: null,
              name: input.name,
              sizeLabel: input.sizeLabel ?? null,
              basePrice: input.basePrice,
              originalPrice: input.originalPrice ?? null,
              activePromotions: input.activePromotions ?? [],
              packPrices: input.packPrices ?? [],
              quantity: clamp(quantity, input.stock),
              stock: input.stock,
            },
      ];

  setStoredCartItems(nextItems);
  return nextItems;
}

export function updateCartQuantity(cartKey: string, quantity: number) {
  const items = getStoredCartItems();
  const nextItems = items
    .map((item) => (item.cartKey === cartKey ? { ...item, quantity: clamp(quantity, item.stock) } : item))
    .filter((item) => item.quantity > 0);
  setStoredCartItems(nextItems);
  return nextItems;
}

export function removeFromCart(cartKey: string) {
  const items = getStoredCartItems().filter((item) => item.cartKey !== cartKey);
  setStoredCartItems(items);
  return items;
}

export function clearCart() {
  setStoredCartItems([]);
}

export function getCartCount() {
  return getStoredCartItems().reduce((sum, item) => sum + item.quantity, 0);
}

export function getCartTotal(items: CartItem[]) {
  return items.reduce(
    (sum, item) => sum + resolveDiscountedLineTotal(
        item.basePrice,
        item.activePromotions,
        item.packPrices,
        item.quantity,
        item.originalPrice,
      ),
    0,
  );
}

function clamp(quantity: number, max: number) {
  return Math.min(Math.max(quantity, 0), max);
}