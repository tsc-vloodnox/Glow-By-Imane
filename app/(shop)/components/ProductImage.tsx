// Destination : app/(shop)/components/ProductImage.tsx
"use client";

import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { catalogPath } from "@/lib/images";

type ProductImageProps = {
  imageName: string | undefined | null;
  alt: string;
  className?: string;
};

export function ProductImage({ imageName, alt, className }: ProductImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const src = catalogPath(imageName);

  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-[var(--color-sand)] ${className ?? ""}`}>
        <span className="font-serif text-[var(--color-warm)] text-5xl">✦</span>
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? ""}`}>
      {!isLoaded ? <Skeleton className="absolute inset-0 h-full w-full" /> : null}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setIsLoaded(true)}
        className={`h-full w-full object-cover transition-opacity duration-300 ${isLoaded ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
