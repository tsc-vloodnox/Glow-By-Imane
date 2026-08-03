// Destination : app/(shop)/layout.tsx
// ⚠️ N'enveloppe que {children} (et CartFloatingButton) avec <CartProvider> —
// reporte le reste de ton layout existant (header, nav, etc.) autour de ça.

import { CartProvider } from "./CartContext";
import { CartFloatingButton } from "./components/CartFloatingButton";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <CartProvider>
      {/* ↓ Garde ici le reste de ton layout existant : header, logo, nav, etc. */}
      <div className="mx-auto flex max-w-5xl flex-col">
        <main>{children}</main>
      </div>
      <CartFloatingButton />
    </CartProvider>
  );
}
