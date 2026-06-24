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

export function addToCart(product: { id: string; name: string; price: number }, quantity = 1) {
  const items = getStoredCartItems();
  const existing = items.find((item) => item.productId === product.id);

  if (existing) {
    existing.quantity += quantity;
  } else {
    items.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity,
    });
  }

  setStoredCartItems(items);
  return items;
}

export function updateCartQuantity(productId: string, quantity: number) {
  const items = getStoredCartItems();
  const nextItems = items
    .map((item) => (item.productId === productId ? { ...item, quantity } : item))
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
