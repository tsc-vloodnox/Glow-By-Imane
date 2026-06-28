// Destination : app/(shop)/CartContext.tsx
"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  addToCart as addToCartStorage,
  clearCart as clearCartStorage,
  getStoredCartItems,
  removeFromCart as removeFromCartStorage,
  setStoredCartItems,
  updateCartQuantity as updateCartQuantityStorage,
  type CartItem,
} from "@/lib/cart";

type CartContextValue = {
  items: CartItem[];
  count: number;
  total: number;
  addItem: (product: { id: string; name: string; price: number }, quantity?: number, stock?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clear: () => void;
  replaceAll: (items: CartItem[]) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  // Hydratation après montage (localStorage n'existe pas côté serveur)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(getStoredCartItems());
  }, []);

  // Garde la synchro entre onglets/fenêtres (un seul listener, ici, au lieu
  // de le dupliquer dans chaque composant comme avant)
  useEffect(() => {
    const sync = () => setItems(getStoredCartItems());
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const addItem = useCallback<CartContextValue["addItem"]>((product, quantity = 1, stock) => {
    setItems(addToCartStorage(product, quantity, stock));
  }, []);

  const updateQuantity = useCallback<CartContextValue["updateQuantity"]>((productId, quantity) => {
    setItems(updateCartQuantityStorage(productId, quantity));
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(removeFromCartStorage(productId));
  }, []);

  const clear = useCallback(() => {
    clearCartStorage();
    setItems([]);
  }, []);

  const replaceAll = useCallback((nextItems: CartItem[]) => {
    setStoredCartItems(nextItems);
    setItems(nextItems);
  }, []);

  const { count, total } = useMemo(
    () => ({
      count: items.reduce((sum, item) => sum + item.quantity, 0),
      total: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    }),
    [items],
  );

  const value = useMemo(
    () => ({ items, count, total, addItem, updateQuantity, removeItem, clear, replaceAll }),
    [items, count, total, addItem, updateQuantity, removeItem, clear, replaceAll],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart doit être utilisé à l'intérieur de <CartProvider>");
  }
  return context;
}
