// Destination : app/(shop)/components/ProductImage.tsx
"use client";

import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { catalogPath } from "@/lib/images";

type ProductImageProps = {
  imageName: string | undefined | null;
  alt: string;
  className?: string;
  // Optionnel : affiche un badge "N photos" sur la card home si le produit
  // a plusieurs images (invite l'utilisateur à cliquer pour voir le slider).
  imageCount?: number;
};

export function ProductImage({ imageName, alt, className, imageCount }: ProductImageProps) {
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
      {/* {!isLoaded ? <Skeleton className="absolute inset-0 h-full w-full" /> : null} */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => setIsLoaded(true)}
        className="h-full w-full object-cover transition-opacity duration-300"
      />
      {/* Badge discret indiquant qu'il y a d'autres photos sur la fiche produit */}
      {imageCount && imageCount > 1 ? (
        <span className="absolute bottom-2 right-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] text-white backdrop-blur-sm">
          +{imageCount - 1} photo{imageCount - 1 > 1 ? "s" : ""}
        </span>
      ) : null}
    </div>
  );
}
