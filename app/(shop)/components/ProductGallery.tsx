// Destination : app/(shop)/components/ProductGallery.tsx
"use client";

import { useRef, useState } from "react";

import { ProductImage } from "./ProductImage";

// Au-delà, les points ne tiennent plus sur un écran de téléphone : compteur à la place
const MAX_DOTS = 8;

type ProductGalleryProps = {
  images: string[];
  productName: string;
};

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0) return;

    // Avant : le premier point était toujours actif en dur, peu importe
    // la position réelle du scroll. Ici on déduit l'index visible à partir
    // de la position de scroll horizontale.
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(Math.min(Math.max(index, 0), images.length - 1));
  };

  return (
    <section className="relative">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto [scroll-snap-stop:always]"
      >
        {images.map((imageName, index) => (
          <div key={`${imageName}-${index}`} className="w-full flex-none snap-start aspect-[4/5]">
            <ProductImage imageName={imageName} alt={`${productName} ${index + 1}`} className="h-full w-full" />
          </div>
        ))}
      </div>

      {images.length > 1 && images.length <= MAX_DOTS ? (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
          {images.map((_, index) => (
            <span
              key={index}
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                index === activeIndex ? "bg-[var(--color-accent)]" : "bg-[var(--color-accent)]/25"
              }`}
            />
          ))}
        </div>
      ) : null}

      {/* Beaucoup de photos : un compteur plutôt qu'une rangée de points qui déborde */}
      {images.length > MAX_DOTS ? (
        <span className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
          {activeIndex + 1} / {images.length}
        </span>
      ) : null}
    </section>
  );
}
