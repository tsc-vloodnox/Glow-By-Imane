// Destination : lib/cart.ts

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  stock: number; // stock connu au moment de l'ajout, sert de borne dans l'UI panier
};

const CART_STORAGE_KEY = "glow-cart-items";
const FALLBACK_STOCK = 99; // si jamais un item plus ancien n'a pas de stock stocké

export function getStoredCartItems(): CartItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as Partial<CartItem>[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    // Compatibilité avec d'anciens paniers stockés avant l'ajout du champ `stock`
    return parsed.map((item) => ({
      productId: item.productId ?? "",
      name: item.name ?? "",
      price: item.price ?? 0,
      quantity: item.quantity ?? 1,
      stock: typeof item.stock === "number" ? item.stock : FALLBACK_STOCK,
    }));
  } catch {
    return [];
  }
}

function emitCartUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("glow-cart-updated"));
  }
}

export function setStoredCartItems(items: CartItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  emitCartUpdated();
}

/**
 * @param stock Stock connu au moment de l'ajout (ex: depuis la fiche produit).
 *   Stocké sur l'item pour pouvoir borner la quantité directement dans le panier,
 *   sans dépendre d'un appel serveur à chaque changement.
 */
export function addToCart(
  product: { id: string; name: string; price: number },
  quantity = 1,
  stock: number = FALLBACK_STOCK,
) {
  const items = getStoredCartItems();
  const existing = items.find((item) => item.productId === product.id);

  const nextItems = existing
    ? items.map((item) =>
        item.productId === product.id
          ? { ...item, stock, quantity: clamp(item.quantity + quantity, stock) }
          : item,
      )
    : [
        ...items,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: clamp(quantity, stock),
          stock,
        },
      ];

  setStoredCartItems(nextItems);
  return nextItems;
}

/**
 * Borne automatiquement à `item.stock` (plus besoin de le repasser à chaque appel
 * depuis l'UI — la quantité ne peut jamais dépasser ce qui est connu en stock).
 */
export function updateCartQuantity(productId: string, quantity: number) {
  const items = getStoredCartItems();
  const nextItems = items
    .map((item) =>
      item.productId === productId ? { ...item, quantity: clamp(quantity, item.stock) } : item,
    )
    .filter((item) => item.quantity > 0);

  setStoredCartItems(nextItems);
  return nextItems;
}

export function removeFromCart(productId: string) {
  const items = getStoredCartItems().filter((item) => item.productId !== productId);
  setStoredCartItems(items);
  return items;
}

export function clearCart() {
  setStoredCartItems([]);
}

export function getCartCount() {
  return getStoredCartItems().reduce((sum, item) => sum + item.quantity, 0);
}

function clamp(quantity: number, max: number) {
  return Math.min(Math.max(quantity, 0), max);
}
