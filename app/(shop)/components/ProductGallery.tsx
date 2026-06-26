// Destination : app/(shop)/components/ProductGallery.tsx
"use client";

import { useCallback, useRef, useState } from "react";

import { ProductImage } from "./ProductImage";

type ProductGalleryProps = {
  images: string[];
  productName: string;
};

export function ProductGallery({ images, productName }: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el || el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(Math.min(Math.max(index, 0), images.length - 1));
  }, [images.length]);

  // Permet de cliquer sur un point pour naviguer directement vers la slide
  const scrollToIndex = useCallback((index: number) => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  }, []);

  // Garde une image de fallback si le tableau est vide
  if (images.length === 0) {
    return (
      <section className="relative aspect-[4/5]">
        <ProductImage imageName={null} alt={productName} className="h-full w-full" />
      </section>
    );
  }

  return (
    <section className="relative">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {images.map((imageName, index) => (
          <div
            key={`${imageName}-${index}`}
            className="w-full flex-none snap-start aspect-[4/5]"
          >
            <ProductImage
              imageName={imageName}
              alt={`${productName} — photo ${index + 1}`}
              className="h-full w-full"
            />
          </div>
        ))}
      </div>

      {images.length > 1 ? (
        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
          {images.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`Photo ${index + 1}`}
              onClick={() => scrollToIndex(index)}
              className={`h-2.5 w-2.5 rounded-full transition-colors ${
                index === activeIndex
                  ? "bg-[var(--color-accent)]"
                  : "bg-[var(--color-accent)]/25"
              }`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
