// Destination : app/(shop)/components/ShopSearchFilterBar.tsx
"use client";

import { useState } from "react";

type CategoryItem = { id: string; label: string };

type ShopSearchFilterBarProps = {
  categories: CategoryItem[];
  activeCategory: string;
  onCategoryChange: (categoryId: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
};

export function ShopSearchFilterBar({
  categories,
  activeCategory,
  onCategoryChange,
  searchValue,
  onSearchChange,
}: ShopSearchFilterBarProps) {
  const [tagsOpen, setTagsOpen] = useState(false);
  const hasActiveFilter = activeCategory !== "all";

  return (
    <div className="sticky top-0 z-20 bg-[var(--color-cream)]/95 backdrop-blur px-4 py-2 border-b border-[var(--color-border)]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTagsOpen((open) => !open)}
          aria-expanded={tagsOpen}
          aria-label="Filtrer par catégorie"
          className={`relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border transition-colors ${
            tagsOpen || hasActiveFilter
              ? "border-transparent bg-[var(--color-accent)] text-white"
              : "border-[var(--color-border)] text-[var(--color-accent)]"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M7 12h10M10 18h4" strokeLinecap="round" />
          </svg>
          {hasActiveFilter ? (
            <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[var(--color-gold)]" />
          ) : null}
        </button>

        <div className="relative flex-1">
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Rechercher un produit..."
            className="w-full rounded-full border border-[var(--color-border)] bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
          />
        </div>
      </div>

      {/* Row des tags, repliée par défaut pour ne pas prendre de place en permanence */}
      <div
        className={`overflow-hidden transition-all duration-300 ${
          tagsOpen ? "mt-2 max-h-12 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onCategoryChange("all")}
            className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              activeCategory === "all"
                ? "bg-[var(--color-accent)] text-white"
                : "bg-[var(--color-blush)] text-[var(--color-accent)]"
            }`}
          >
            Tout
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => onCategoryChange(category.id)}
              className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                activeCategory === category.id
                  ? "bg-[var(--color-accent)] text-white"
                  : "bg-[var(--color-blush)] text-[var(--color-accent)]"
              }`}
            >
              {category.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
