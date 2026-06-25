"use client";

import Image from "next/image";
import { useState, useTransition } from "react";

import { archiveProduct, deleteProduct, restoreProduct, updateProduct } from "../actions";
import { uploadProductImage } from "./upload";

type ProductRow = {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  favorite: boolean;
  archived: boolean;
  categoryId: string;
  category: { id: string; name: string };
  images: string[];
  _count: { orderItems: number };
};

type AdminProductsTableProps = {
  initialProducts: ProductRow[];
  categories: { id: string; name: string }[];
  storageBaseUrl: string; // ex: https://xxx.supabase.co/storage/v1/object/public/catalogue
};

type Filter = "actifs" | "archives";

export function AdminProductsTable({ initialProducts, categories, storageBaseUrl }: AdminProductsTableProps) {
  const [isPending, startTransition] = useTransition();
  const [products, setProducts] = useState(initialProducts);
  const [savedProducts, setSavedProducts] = useState(initialProducts);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("actifs");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [stockFilter, setStockFilter] = useState<"tous" | "rupture" | "bas">("tous");
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingImagesId, setEditingImagesId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  function updateField(productId: string, field: keyof ProductRow, value: string | boolean | number) {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, [field]: value } : p)),
    );
  }

  function isDirty(product: ProductRow) {
    const original = savedProducts.find((p) => p.id === product.id);
    if (!original) return false;
    return (
      original.name !== product.name ||
      original.description !== product.description ||
      original.price !== product.price ||
      original.stock !== product.stock ||
      original.favorite !== product.favorite ||
      original.categoryId !== product.categoryId ||
      JSON.stringify(original.images) !== JSON.stringify(product.images)
    );
  }

  function updateImages(productId: string, images: string[]) {
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, images } : p)));
  }

  function moveImage(productId: string, index: number, direction: -1 | 1) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const next = [...product.images];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateImages(productId, next);
  }

  function removeImage(productId: string, index: number) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    updateImages(productId, product.images.filter((_, i) => i !== index));
  }

  async function handleImageUpload(productId: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingId(productId);
    try {
      const results = await Promise.allSettled(Array.from(files).map(uploadProductImage));
      const uploaded = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      const product = products.find((p) => p.id === productId);
      if (product && uploaded.length > 0) {
        updateImages(productId, [...product.images, ...uploaded]);
      }
      const failures = results.filter((r) => r.status === "rejected").length;
      if (failures > 0) setActionError(`${failures} image(s) non téléchargée(s).`);
    } catch {
      setActionError("Erreur lors du téléchargement des images.");
    } finally {
      setUploadingId(null);
    }
  }

  async function handleSave(productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const formData = new FormData();
    formData.set("name", product.name);
    formData.set("description", product.description);
    formData.set("price", String(product.price));
    formData.set("stock", String(product.stock));
    formData.set("categoryId", product.categoryId);
    formData.set("favorite", product.favorite ? "on" : "");
    formData.set("images", product.images.join("\n"));

    setSavingId(productId);
    startTransition(async () => {
      await updateProduct(productId, formData);
      setSavedProducts((prev) => prev.map((p) => (p.id === productId ? product : p)));
      setSavingId(null);
      setJustSavedId(productId);
      setTimeout(() => setJustSavedId((cur) => (cur === productId ? null : cur)), 2000);
    });
  }

  async function handleArchive(productId: string) {
    startTransition(async () => {
      await archiveProduct(productId);
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, archived: true, favorite: false } : p)));
      setSavedProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, archived: true, favorite: false } : p)));
      setConfirmArchiveId(null);
    });
  }

  async function handleRestore(productId: string) {
    startTransition(async () => {
      await restoreProduct(productId);
      setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, archived: false } : p)));
      setSavedProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, archived: false } : p)));
    });
  }

  async function handleDelete(productId: string) {
    setActionError(null);
    startTransition(async () => {
      try {
        await deleteProduct(productId);
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        setSavedProducts((prev) => prev.filter((p) => p.id !== productId));
        setConfirmDeleteId(null);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Erreur lors de la suppression.");
        setConfirmDeleteId(null);
      }
    });
  }

  const q = search.trim().toLowerCase();

  const visible = products.filter((p) => {
    if (filter === "actifs" ? p.archived : !p.archived) return false;
    if (categoryFilter && p.categoryId !== categoryFilter) return false;
    if (stockFilter === "rupture" && p.stock !== 0) return false;
    if (stockFilter === "bas" && !(p.stock > 0 && p.stock <= 3)) return false;
    if (q && !p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;
    return true;
  });

  const activeCount = products.filter((p) => !p.archived).length;
  const archivedCount = products.filter((p) => p.archived).length;

  return (
    <div className="space-y-4">
      {/* Tabs filtre */}
      <div className="flex gap-1 rounded-xl border border-[var(--color-border)] bg-white p-1 w-fit">
        {(["actifs", "archives"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === f
                ? "bg-[var(--color-accent)] text-white"
                : "text-[var(--color-muted)] hover:text-[var(--color-accent)]"
            }`}
          >
            {f === "actifs" ? `Actifs (${activeCount})` : `Archivés (${archivedCount})`}
          </button>
        ))}
      </div>

      {/* Barre de recherche + filtres */}
      <div className="flex flex-wrap gap-2">
        {/* Recherche texte */}
        <div className="relative flex-1 min-w-48">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--color-muted)]">
            🔍
          </span>
          <input
            type="search"
            placeholder="Rechercher un produit…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-[var(--color-accent)]"
          />
        </div>

        {/* Filtre catégorie */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-muted)] outline-none focus:border-[var(--color-accent)]"
        >
          <option value="">Toutes les catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {/* Filtre stock */}
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value as "tous" | "rupture" | "bas")}
          className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-muted)] outline-none focus:border-[var(--color-accent)]"
        >
          <option value="tous">Tout le stock</option>
          <option value="bas">Stock bas (≤ 3)</option>
          <option value="rupture">Rupture (0)</option>
        </select>

        {/* Reset filtres */}
        {(search || categoryFilter || stockFilter !== "tous") && (
          <button
            type="button"
            onClick={() => { setSearch(""); setCategoryFilter(""); setStockFilter("tous"); }}
            className="rounded-xl border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-muted)] hover:text-red-500"
          >
            ✕ Réinitialiser
          </button>
        )}
      </div>

      {/* Compteur résultats */}
      {(search || categoryFilter || stockFilter !== "tous") && (
        <p className="text-xs text-[var(--color-muted)]">
          {visible.length} résultat{visible.length > 1 ? "s" : ""}
        </p>
      )}
      {actionError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 text-sm text-[var(--color-muted)]">
          {search || categoryFilter || stockFilter !== "tous"
            ? "Aucun produit ne correspond à ces filtres."
            : filter === "actifs" ? "Aucun produit actif." : "Aucun produit archivé."}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((product) => {
            const dirty = isDirty(product);
            const saving = savingId === product.id && isPending;
            const justSaved = justSavedId === product.id;
            const lowStock = product.stock > 0 && product.stock <= 3;
            const outOfStock = product.stock === 0;
            const thumbnail = product.images[0]
              ? `${storageBaseUrl}/${product.images[0]}`
              : null;

            return (
              <div
                key={product.id}
                className={`rounded-xl border bg-white p-4 transition-colors ${
                  product.archived
                    ? "border-[var(--color-border)] opacity-60"
                    : dirty
                    ? "border-[var(--color-accent)]"
                    : "border-[var(--color-border)]"
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Miniature */}
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-sand)]">
                    {thumbnail ? (
                      <Image
                        src={thumbnail}
                        alt={product.name}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    ) : (
                      <span className="flex h-full items-center justify-center text-lg text-[var(--color-muted)]">
                        🖼
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Nom + badges */}
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={product.name}
                        onChange={(e) => updateField(product.id, "name", e.target.value)}
                        disabled={product.archived}
                        placeholder="Nom du produit"
                        className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-base font-medium disabled:bg-[var(--color-sand)]"
                      />
                      {outOfStock && (
                        <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          Rupture
                        </span>
                      )}
                      {lowStock && !outOfStock && (
                        <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          Stock bas
                        </span>
                      )}
                      {product.archived && (
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          Archivé
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <textarea
                      rows={2}
                      value={product.description}
                      onChange={(e) => updateField(product.id, "description", e.target.value)}
                      disabled={product.archived}
                      placeholder="Description"
                      className="mt-2 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:bg-[var(--color-sand)]"
                    />

                    {/* Catégorie / Prix / Stock */}
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <select
                        value={product.categoryId}
                        onChange={(e) => updateField(product.id, "categoryId", e.target.value)}
                        disabled={product.archived}
                        className="col-span-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm sm:col-span-1 disabled:bg-[var(--color-sand)]"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>

                      <label className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
                        <span className="shrink-0 text-[var(--color-muted)]">Prix</span>
                        <input
                          type="number"
                          min="0"
                          inputMode="decimal"
                          value={product.price}
                          onChange={(e) => updateField(product.id, "price", Number(e.target.value))}
                          disabled={product.archived}
                          className="w-full min-w-0 bg-transparent outline-none disabled:text-[var(--color-muted)]"
                        />
                      </label>

                      <label className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
                        <span className="shrink-0 text-[var(--color-muted)]">Stock</span>
                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          value={product.stock}
                          onChange={(e) => updateField(product.id, "stock", Number(e.target.value))}
                          disabled={product.archived}
                          className="w-full min-w-0 bg-transparent outline-none disabled:text-[var(--color-muted)]"
                        />
                      </label>
                    </div>

                    {/* Favori */}
                    {!product.archived && (
                      <label className="mt-2 flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={product.favorite}
                          onChange={(e) => updateField(product.id, "favorite", e.target.checked)}
                        />
                        <span className="text-[var(--color-muted)]">Mettre en favori</span>
                      </label>
                    )}

                    {/* Images */}
                    {!product.archived && (
                      <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                        <button
                          type="button"
                          onClick={() =>
                            setEditingImagesId(
                              editingImagesId === product.id ? null : product.id,
                            )
                          }
                          className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-accent)]"
                        >
                          <span>🖼</span>
                          {editingImagesId === product.id ? "Fermer les images" : `Images (${product.images.length})`}
                        </button>

                        {editingImagesId === product.id && (
                          <div className="mt-3 space-y-3">
                            {/* Grille miniatures */}
                            {product.images.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {product.images.map((img, i) => (
                                  <div key={img + i} className="group relative">
                                    <div className="relative h-20 w-20 overflow-hidden rounded-lg border border-[var(--color-border)]">
                                      <Image
                                        src={`${storageBaseUrl}/${img}`}
                                        alt={`Image ${i + 1}`}
                                        fill
                                        className="object-cover"
                                        sizes="80px"
                                      />
                                      {i === 0 && (
                                        <span className="absolute left-1 top-1 rounded-full bg-[var(--color-accent)] px-1.5 py-0.5 text-[9px] font-medium text-white">
                                          Principale
                                        </span>
                                      )}
                                    </div>
                                    {/* Contrôles */}
                                    <div className="mt-1 flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => moveImage(product.id, i, -1)}
                                        disabled={i === 0}
                                        className="text-xs text-[var(--color-muted)] disabled:opacity-20 hover:text-[var(--color-accent)]"
                                        title="Déplacer à gauche"
                                      >
                                        ←
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeImage(product.id, i)}
                                        className="text-xs text-red-400 hover:text-red-600"
                                        title="Retirer"
                                      >
                                        ✕
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => moveImage(product.id, i, 1)}
                                        disabled={i === product.images.length - 1}
                                        className="text-xs text-[var(--color-muted)] disabled:opacity-20 hover:text-[var(--color-accent)]"
                                        title="Déplacer à droite"
                                      >
                                        →
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-[var(--color-muted)]">Aucune image.</p>
                            )}

                            {/* Upload */}
                            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2.5 text-xs text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]">
                              {uploadingId === product.id ? (
                                <span>Téléchargement…</span>
                              ) : (
                                <>
                                  <span>+</span>
                                  <span>Ajouter des images</span>
                                </>
                              )}
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="sr-only"
                                disabled={uploadingId === product.id}
                                onChange={(e) => handleImageUpload(product.id, e.target.files)}
                              />
                            </label>

                            <p className="text-[10px] text-[var(--color-muted)]">
                              Les modifications d&apos;images sont enregistrées avec le bouton &quot;Enregistrer&quot;.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
                  <div className="flex items-center gap-3">
                    {!product.archived ? (
                      <>
                        {/* Archiver */}
                        {confirmArchiveId === product.id ? (
                          <span className="flex items-center gap-2 text-sm">
                            <span className="text-[var(--color-muted)]">Archiver ?</span>
                            <button
                              type="button"
                              onClick={() => handleArchive(product.id)}
                              disabled={isPending}
                              className="font-medium text-amber-600 hover:underline"
                            >
                              Confirmer
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmArchiveId(null)}
                              className="text-[var(--color-muted)] hover:underline"
                            >
                              Annuler
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmArchiveId(product.id)}
                            className="text-sm text-[var(--color-muted)] hover:text-amber-600"
                          >
                            Archiver
                          </button>
                        )}

                        {/* Supprimer définitivement — seulement si aucune commande */}
                        {product._count.orderItems === 0 && (
                          confirmDeleteId === product.id ? (
                            <span className="flex items-center gap-2 text-sm">
                              <span className="text-[var(--color-muted)]">Supprimer ?</span>
                              <button
                                type="button"
                                onClick={() => handleDelete(product.id)}
                                disabled={isPending}
                                className="font-medium text-red-600 hover:underline"
                              >
                                Confirmer
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-[var(--color-muted)] hover:underline"
                              >
                                Annuler
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(product.id)}
                              className="text-sm text-red-500 hover:text-red-700"
                            >
                              Supprimer
                            </button>
                          )
                        )}
                      </>
                    ) : (
                      /* Restaurer */
                      <button
                        type="button"
                        onClick={() => handleRestore(product.id)}
                        disabled={isPending}
                        className="text-sm text-[var(--color-accent)] hover:underline"
                      >
                        Restaurer
                      </button>
                    )}
                  </div>

                  {!product.archived && (
                    <button
                      type="button"
                      onClick={() => handleSave(product.id)}
                      disabled={!dirty || saving}
                      className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
                    >
                      {saving ? "Enregistrement…" : justSaved ? "Enregistré ✓" : "Enregistrer"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}