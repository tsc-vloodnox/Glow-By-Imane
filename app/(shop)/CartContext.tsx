"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  addToCart as addToCartStorage,
  clearCart as clearCartStorage,
  getCartTotal,
  getStoredCartItems,
  removeFromCart as removeFromCartStorage,
  setStoredCartItems,
  updateCartQuantity as updateCartQuantityStorage,
  type CartItem,
} from "@/lib/cart";
import type { ActivePromotion } from "@/lib/pricing";
import { trackPixelEvent } from "@/lib/fbpixel";

type AddProductArgs = {
  kind: "product";
  productId: string;
  productSizeId?: string | null;
  sizeLabel?: string | null;
  name: string;
  basePrice: number;
  activePromotions?: ActivePromotion[];
  packPrices?: { quantity: number; price: number }[];
  stock: number;
};

type AddKitArgs = {
  kind: "kit";
  kitId: string;
  name: string;
  basePrice: number;
  activePromotions?: ActivePromotion[];
  stock: number;
};

type CartContextValue = {
  items: CartItem[];
  count: number;
  total: number;
  addItem: (input: AddProductArgs | AddKitArgs, quantity?: number) => void;
  updateQuantity: (cartKey: string, quantity: number) => void;
  removeItem: (cartKey: string) => void;
  clear: () => void;
  replaceAll: (items: CartItem[]) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(getStoredCartItems());
  }, []);

  useEffect(() => {
    const sync = () => setItems(getStoredCartItems());
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const addItem = useCallback<CartContextValue["addItem"]>((input, quantity = 1) => {
    setItems(addToCartStorage(input, quantity));
    trackPixelEvent("AddToCart", {
      content_ids: [input.kind === "product" ? input.productId : input.kitId],
      content_name: input.name,
      content_type: input.kind,
      value: input.basePrice * quantity,
      currency: "GNF",
    });
  }, []);

  const updateQuantity = useCallback<CartContextValue["updateQuantity"]>((cartKey, quantity) => {
    setItems(updateCartQuantityStorage(cartKey, quantity));
  }, []);

  const removeItem = useCallback((cartKey: string) => {
    setItems(removeFromCartStorage(cartKey));
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
    () => ({ count: items.reduce((sum, item) => sum + item.quantity, 0), total: getCartTotal(items) }),
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
  if (!context) throw new Error("useCart doit être utilisé à l'intérieur de <CartProvider>");
  return context;
}