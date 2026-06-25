// Destination : lib/cart.ts

export type CartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
};

const CART_STORAGE_KEY = "glow-cart-items";

export function getStoredCartItems(): CartItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
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
 * @param maxQuantity Optionnel — borne la quantité finale (ex: stock connu côté UI).
 *   Si non fourni, aucune limite n'est appliquée ici (le serveur reste le garant final).
 */
export function addToCart(
  product: { id: string; name: string; price: number },
  quantity = 1,
  maxQuantity?: number,
) {
  const items = getStoredCartItems();
  const existing = items.find((item) => item.productId === product.id);

  const nextItems = existing
    ? items.map((item) =>
        item.productId === product.id
          ? { ...item, quantity: clamp(item.quantity + quantity, maxQuantity) }
          : item,
      )
    : [
        ...items,
        {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity: clamp(quantity, maxQuantity),
        },
      ];

  setStoredCartItems(nextItems);
  return nextItems;
}

export function updateCartQuantity(productId: string, quantity: number, maxQuantity?: number) {
  const items = getStoredCartItems();
  const nextItems = items
    .map((item) =>
      item.productId === productId ? { ...item, quantity: clamp(quantity, maxQuantity) } : item,
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

function clamp(quantity: number, max?: number) {
  if (typeof max === "number") {
    return Math.min(Math.max(quantity, 0), max);
  }
  return Math.max(quantity, 0);
}
