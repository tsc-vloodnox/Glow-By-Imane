// Destination : app/admin/promotions/PromotionsClient.tsx
"use client";

import { useState, useTransition } from "react";

import {
  createPromotion,
  deletePromotion,
  togglePromotion,
  type PromotionInput,
} from "./actions";

type Product = { id: string; name: string; price: number; categoryName: string };

type Promotion = {
  id: string;
  name: string;
  discountPercent: number;
  startAt: Date;
  endAt: Date;
  active: boolean;
  status: "active" | "scheduled" | "expired" | "inactive";
  products: { product: { id: string; name: string; price: number } }[];
};

const STATUS_CONFIG = {
  active:    { label: "Active",     className: "bg-green-100 text-green-700" },
  scheduled: { label: "Planifiée",  className: "bg-blue-100 text-blue-700" },
  expired:   { label: "Expirée",    className: "bg-gray-100 text-gray-500" },
  inactive:  { label: "Désactivée", className: "bg-amber-100 text-amber-700" },
};

const EMPTY_FORM: PromotionInput = {
  name: "",
  discountPercent: 10,
  startAt: new Date().toISOString().slice(0, 16),
  endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
  productIds: [],
};

export function PromotionsClient({
  promotions: initial,
  allProducts,
}: {
  promotions: Promotion[];
  allProducts: Product[];
}) {
  const [promotions, setPromotions] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PromotionInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Catégories pour la sélection groupée
  const categories = [...new Set(allProducts.map((p) => p.categoryName))].sort();

  const toggleProductId = (productId: string) => {
    setForm((prev) => ({
      ...prev,
      productIds: prev.productIds.includes(productId)
        ? prev.productIds.filter((id) => id !== productId)
        : [...prev.productIds, productId],
    }));
  };

  const selectCategory = (categoryName: string) => {
    const ids = allProducts
      .filter((p) => p.categoryName === categoryName)
      .map((p) => p.id);
    const allSelected = ids.every((id) => form.productIds.includes(id));
    setForm((prev) => ({
      ...prev,
      productIds: allSelected
        ? prev.productIds.filter((id) => !ids.includes(id))
        : [...new Set([...prev.productIds, ...ids])],
    }));
  };

  const handleCreate = () => {
    if (form.productIds.length === 0) {
      setError("Sélectionnez au moins un produit.");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        await createPromotion(form);
        setShowForm(false);
        setForm(EMPTY_FORM);
        // Optimiste : on recharge la page via revalidatePath côté serveur
        window.location.reload();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de la création.");
      }
    });
  };

  const handleToggle = (id: string, active: boolean) => {
    startTransition(async () => {
      try {
        await togglePromotion(id, active);
        setPromotions((prev) =>
          prev.map((p) =>
            p.id === id
              ? { ...p, active, status: active ? "active" : "inactive" }
              : p,
          ),
        );
      } catch {
        setError("Erreur lors de la mise à jour.");
      }
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (!window.confirm(`Supprimer la promotion "${name}" ?`)) return;
    startTransition(async () => {
      try {
        await deletePromotion(id);
        setPromotions((prev) => prev.filter((p) => p.id !== id));
      } catch {
        setError("Erreur lors de la suppression.");
      }
    });
  };

  const fmt = (date: Date) =>
    new Date(date).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {/* Bouton ouvrir le formulaire */}
      {!showForm ? (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white"
        >
          + Nouvelle promotion
        </button>
      ) : (
        // Formulaire de création
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-5 space-y-4">
          <h2 className="font-medium text-sm">Nouvelle promotion</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-xs text-[var(--color-muted)]">Nom</span>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="ex: Soldes été 2026"
                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs text-[var(--color-muted)]">Remise (%)</span>
              <input
                type="number"
                min={1}
                max={99}
                value={form.discountPercent}
                onChange={(e) =>
                  setForm((f) => ({ ...f, discountPercent: Number(e.target.value) }))
                }
                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs text-[var(--color-muted)]">Début</span>
              <input
                type="datetime-local"
                value={form.startAt}
                onChange={(e) => setForm((f) => ({ ...f, startAt: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-xs text-[var(--color-muted)]">Fin</span>
              <input
                type="datetime-local"
                value={form.endAt}
                onChange={(e) => setForm((f) => ({ ...f, endAt: e.target.value }))}
                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
              />
            </label>
          </div>

          {/* Sélection des produits groupée par catégorie */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--color-muted)]">
                Produits concernés ({form.productIds.length} sélectionné{form.productIds.length > 1 ? "s" : ""})
              </span>
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    productIds:
                      f.productIds.length === allProducts.length
                        ? []
                        : allProducts.map((p) => p.id),
                  }))
                }
                className="text-xs text-[var(--color-accent)]"
              >
                {form.productIds.length === allProducts.length ? "Tout désélectionner" : "Tout sélectionner"}
              </button>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-lg border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
              {categories.map((category) => {
                const categoryProducts = allProducts.filter(
                  (p) => p.categoryName === category,
                );
                const allCatSelected = categoryProducts.every((p) =>
                  form.productIds.includes(p.id),
                );

                return (
                  <div key={category}>
                    {/* En-tête de catégorie — sélectionne/désélectionne toute la catégorie */}
                    <button
                      type="button"
                      onClick={() => selectCategory(category)}
                      className="flex w-full items-center justify-between bg-[var(--color-sand)] px-3 py-2 text-left"
                    >
                      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">
                        {category}
                      </span>
                      <span className="text-[10px] text-[var(--color-accent)]">
                        {allCatSelected ? "Tout désélectionner" : "Tout sélectionner"}
                      </span>
                    </button>

                    {categoryProducts.map((product) => (
                      <label
                        key={product.id}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-[var(--color-blush)]"
                      >
                        <input
                          type="checkbox"
                          checked={form.productIds.includes(product.id)}
                          onChange={() => toggleProductId(product.id)}
                          className="accent-[var(--color-accent)]"
                        />
                        <span className="flex-1 text-sm">{product.name}</span>
                        <span className="text-xs text-[var(--color-muted)]">
                          {product.price.toLocaleString("fr-GN")} GNF
                        </span>
                      </label>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleCreate}
              disabled={isPending || !form.name.trim()}
              className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isPending ? "Création..." : "Créer la promotion"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setError(null); }}
              className="rounded-xl border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-muted)]"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Liste des promotions */}
      {promotions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted)]">
          Aucune promotion pour le moment.
        </div>
      ) : (
        <div className="space-y-2">
          {promotions.map((promo) => {
            const cfg = STATUS_CONFIG[promo.status];
            return (
              <div
                key={promo.id}
                className="rounded-xl border border-[var(--color-border)] bg-white p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{promo.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cfg.className}`}>
                        {cfg.label}
                      </span>
                      <span className="rounded-full bg-[var(--color-blush)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-accent)]">
                        -{promo.discountPercent}%
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">
                      {fmt(promo.startAt)} → {fmt(promo.endAt)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">
                      {promo.products.length} produit{promo.products.length > 1 ? "s" : ""} :{" "}
                      {promo.products
                        .slice(0, 3)
                        .map((p) => p.product.name)
                        .join(", ")}
                      {promo.products.length > 3 ? ` +${promo.products.length - 3}` : ""}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggle(promo.id, !promo.active)}
                      disabled={isPending}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                        promo.active
                          ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                          : "border-green-200 text-green-700 hover:bg-green-50"
                      }`}
                    >
                      {promo.active ? "Désactiver" : "Activer"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(promo.id, promo.name)}
                      disabled={isPending}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50"
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
