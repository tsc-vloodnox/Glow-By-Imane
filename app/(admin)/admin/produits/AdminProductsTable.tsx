"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateProduct } from "./actions";
import { DeleteProductButton } from "./DeleteProductButton";

type ProductRow = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  favorite: boolean;
  categoryId: string;
  category: { id: string; name: string };
};

type AdminProductsTableProps = {
  initialProducts: ProductRow[];
  categories: { id: string; name: string }[];
};

export function AdminProductsTable({ initialProducts, categories }: AdminProductsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [products, setProducts] = useState(initialProducts);
  // Garde une copie de référence pour savoir quelles fiches ont été modifiées
  const [savedProducts, setSavedProducts] = useState(initialProducts);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);

  function updateField(productId: string, field: keyof ProductRow, value: string | boolean | number) {
    setProducts((current) =>
      current.map((product) => (product.id === productId ? { ...product, [field]: value } : product)),
    );
  }

  function isDirty(product: ProductRow) {
    const original = savedProducts.find((item) => item.id === product.id);
    if (!original) return false;
    return (
      original.name !== product.name ||
      original.description !== product.description ||
      original.price !== product.price ||
      original.stock !== product.stock ||
      original.favorite !== product.favorite ||
      original.categoryId !== product.categoryId
    );
  }

  async function handleSave(productId: string) {
    const product = products.find((item) => item.id === productId);
    if (!product) {
      return;
    }

    const formData = new FormData();
    formData.set("name", product.name);
    formData.set("description", product.description);
    formData.set("price", String(product.price));
    formData.set("stock", String(product.stock));
    formData.set("categoryId", product.categoryId);
    formData.set("favorite", product.favorite ? "on" : "");

    setSavingId(productId);
    startTransition(async () => {
      await updateProduct(productId, formData);
      setSavedProducts((current) => current.map((item) => (item.id === productId ? product : item)));
      setSavingId(null);
      setJustSavedId(productId);
      setTimeout(() => setJustSavedId((current) => (current === productId ? null : current)), 2000);
      router.refresh();
    });
  }

  if (products.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 text-sm text-[var(--color-muted)]">
        Aucun produit. Ajoutez-en un pour commencer.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {products.map((product) => {
        const dirty = isDirty(product);
        const saving = savingId === product.id && isPending;
        const justSaved = justSavedId === product.id;

        return (
          <div
            key={product.id}
            className={`rounded-xl border bg-white p-4 transition-colors ${
              dirty ? "border-[var(--color-accent)]" : "border-[var(--color-border)]"
            }`}
          >
            {/* En-tête : nom + favori */}
            <div className="flex items-start gap-3">
              <input
                value={product.name}
                onChange={(event) => updateField(product.id, "name", event.target.value)}
                placeholder="Nom du produit"
                className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-base font-medium"
              />
              <label className="flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--color-border)] px-2.5 py-2 text-sm text-[var(--color-muted)]">
                <input
                  type="checkbox"
                  checked={product.favorite}
                  onChange={(event) => updateField(product.id, "favorite", event.target.checked)}
                />
                <span className="hidden sm:inline">Favori</span>
                <span className="sm:hidden">★</span>
              </label>
            </div>

            {/* Description */}
            <textarea
              rows={2}
              value={product.description}
              onChange={(event) => updateField(product.id, "description", event.target.value)}
              placeholder="Description"
              className="mt-2 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
            />

            {/* Catégorie / Prix / Stock — empilés sur mobile, en ligne dès sm */}
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <select
                value={product.categoryId}
                onChange={(event) => updateField(product.id, "categoryId", event.target.value)}
                className="col-span-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm sm:col-span-1"
              >
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

              <label className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
                <span className="shrink-0 text-[var(--color-muted)]">Prix</span>
                <input
                  type="number"
                  min="0"
                  inputMode="decimal"
                  value={product.price}
                  onChange={(event) => updateField(product.id, "price", Number(event.target.value))}
                  className="w-full min-w-0 bg-transparent outline-none"
                />
              </label>

              <label className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
                <span className="shrink-0 text-[var(--color-muted)]">Stock</span>
                <input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={product.stock}
                  onChange={(event) => updateField(product.id, "stock", Number(event.target.value))}
                  className="w-full min-w-0 bg-transparent outline-none"
                />
              </label>
            </div>

            {/* Actions */}
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <Link
                  href={`/admin/produits/${product.id}/edit`}
                  className="text-sm text-[var(--color-accent)] underline-offset-2 hover:underline"
                >
                  Gérer images
                </Link>
                <DeleteProductButton productId={product.id} />
              </div>

              <button
                type="button"
                onClick={() => handleSave(product.id)}
                disabled={!dirty || saving}
                className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
              >
                {saving ? "Enregistrement…" : justSaved ? "Enregistré ✓" : "Enregistrer"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
