"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createProduct, updateProduct } from "../actions";
import { uploadProductImage } from "./upload";

type SizeInput = {
  id: string; // id réel si existant, "tmp_..." si pas encore enregistré
  label: string;
  price: number;
  stock: number;
  archived: boolean;
};

type PackPriceInput = {
  id: string;
  quantity: number;
  price: number;
  productSizeId: string | null; // null = s'applique au produit entier
};

function newTempId() {
  return `tmp_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

// URL publique du bucket — passée en prop depuis le Server Component parent
type ProductFormProps = {
  categories: { id: string; name: string }[];
  storageBaseUrl: string;
  product?: {
    id: string;
    name: string;
    description: string;
    price: number;
    stock: number;
    favorite: boolean;
    images: string[];
    categoryId: string;
    sizes?: SizeInput[];
    packPrices?: PackPriceInput[];
  };
};

export function ProductForm({ categories, storageBaseUrl, product }: ProductFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>(product?.images ?? []);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [sizes, setSizes] = useState<SizeInput[]>(
    (product?.sizes ?? []).filter((s) => !s.archived),
  );
  const [packPrices, setPackPrices] = useState<PackPriceInput[]>(product?.packPrices ?? []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("images", uploadedImages.join("\n"));
    formData.set(
      "sizes",
      JSON.stringify(
        sizes
          .filter((s) => s.label.trim())
          .map((s) => ({
            id: s.id.startsWith("tmp_") ? undefined : s.id,
            label: s.label.trim(),
            price: s.price,
            stock: s.stock,
            archived: s.archived,
          })),
      ),
    );
    formData.set(
      "packPrices",
      JSON.stringify(
        packPrices
          .filter((p) => p.quantity > 0 && p.price > 0)
          .map((p) => ({
            id: p.id.startsWith("tmp_") ? undefined : p.id,
            quantity: p.quantity,
            price: p.price,
            productSizeId: p.productSizeId,
          })),
      ),
    );

    try {
      if (product) {
        await updateProduct(product.id, formData);
      } else {
        await createProduct(formData);
      }
      router.refresh();
      router.push("/admin/produits");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setIsSubmitting(false);
    }
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    setUploadProgress(`Téléchargement de ${files.length} image${files.length > 1 ? "s" : ""}…`);

    try {
      const results = await Promise.allSettled(files.map((file) => uploadProductImage(file)));
      const uploaded = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      const failures = results.filter((r) => r.status === "rejected").length;

      if (uploaded.length > 0) setUploadedImages((prev) => [...prev, ...uploaded]);
      if (failures > 0) setError(`${failures} image${failures > 1 ? "s" : ""} non téléchargée${failures > 1 ? "s" : ""}.`);

      setUploadProgress(
        uploaded.length > 0
          ? `${uploaded.length} image${uploaded.length > 1 ? "s" : ""} ajoutée${uploaded.length > 1 ? "s" : ""}.`
          : "",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du téléchargement.");
      setUploadProgress("");
    } finally {
      event.target.value = "";
    }
  }

  function moveImage(index: number, direction: -1 | 1) {
    setUploadedImages((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  // ─── Tailles ────────────────────────────────────────────────────────────

  function addSize() {
    setSizes((prev) => [
      ...prev,
      { id: newTempId(), label: "", price: 0, stock: 0, archived: false },
    ]);
  }

  function updateSize(sizeId: string, field: "label" | "price" | "stock", value: string | number) {
    setSizes((prev) => prev.map((s) => (s.id === sizeId ? { ...s, [field]: value } : s)));
  }

  function removeSize(sizeId: string) {
    setSizes((prev) => prev.filter((s) => s.id !== sizeId));
    setPackPrices((prev) =>
      prev.map((p) => (p.productSizeId === sizeId ? { ...p, productSizeId: null } : p)),
    );
  }

  // ─── Paliers de quantité ────────────────────────────────────────────────

  function addPackPrice() {
    setPackPrices((prev) => [
      ...prev,
      { id: newTempId(), quantity: 1, price: 0, productSizeId: null },
    ]);
  }

  function updatePackPrice(
    packId: string,
    field: "quantity" | "price" | "productSizeId",
    value: string | number | null,
  ) {
    setPackPrices((prev) => prev.map((p) => (p.id === packId ? { ...p, [field]: value } : p)));
  }

  function removePackPrice(packId: string) {
    setPackPrices((prev) => prev.filter((p) => p.id !== packId));
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm"
    >
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <label className="block space-y-1">
        <span className="text-sm font-medium">Nom</span>
        <input
          name="name"
          required
          defaultValue={product?.name ?? ""}
          className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Description</span>
        <textarea
          name="description"
          rows={4}
          defaultValue={product?.description ?? ""}
          className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3"
        />
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">
            {sizes.length > 0 ? "Prix (défaut)" : "Prix (GNF)"}
          </span>
          <input
            name="price"
            type="number"
            min="0"
            required
            defaultValue={product?.price ?? 0}
            className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">
            {sizes.length > 0 ? "Stock (défaut)" : "Stock"}
          </span>
          <input
            name="stock"
            type="number"
            min="0"
            required
            defaultValue={product?.stock ?? 0}
            className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Catégorie</span>
          <select
            name="categoryId"
            required
            defaultValue={product?.categoryId ?? ""}
            className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3"
          >
            <option value="">Choisir…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
      </div>
      {sizes.length > 0 && (
        <p className="-mt-2 text-xs text-[var(--color-muted)]">
          Ce produit a des tailles : le prix/stock ci-dessus ne sert que de valeur par défaut.
        </p>
      )}

      {/* Déclinaisons & paliers de prix */}
      <div className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-sand)] p-4">
        {/* Déclinaisons (tailles) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Déclinaisons (tailles / contenances)</p>
              <p className="text-xs text-[var(--color-muted)]">
                Laissez vide si ce produit n&apos;a qu&apos;un seul prix.
              </p>
            </div>
            <button
              type="button"
              onClick={addSize}
              className="shrink-0 text-xs font-medium text-[var(--color-accent)] hover:underline"
            >
              + Ajouter une taille
            </button>
          </div>

          {sizes.length > 0 && (
            <div className="space-y-2">
              {sizes.map((size) => (
                <div
                  key={size.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white p-2"
                >
                  <input
                    value={size.label}
                    onChange={(e) => updateSize(size.id, "label", e.target.value)}
                    placeholder="ex: 30ml"
                    className="w-28 min-w-0 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    value={size.price}
                    onChange={(e) => updateSize(size.id, "price", Number(e.target.value))}
                    placeholder="Prix"
                    className="w-24 min-w-0 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    value={size.stock}
                    onChange={(e) => updateSize(size.id, "stock", Number(e.target.value))}
                    placeholder="Stock"
                    className="w-20 min-w-0 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeSize(size.id)}
                    className="ml-auto text-xs text-red-500 hover:text-red-700"
                  >
                    Retirer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Paliers de quantité */}
        <div className="space-y-2 border-t border-[var(--color-border)] pt-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Paliers de quantité</p>
              <p className="text-xs text-[var(--color-muted)]">ex : 3 pour 100 000 GNF au lieu du prix unitaire ×3.</p>
            </div>
            <button
              type="button"
              onClick={addPackPrice}
              className="shrink-0 text-xs font-medium text-[var(--color-accent)] hover:underline"
            >
              + Ajouter un palier
            </button>
          </div>

          {packPrices.length > 0 && (
            <div className="space-y-2">
              {packPrices.map((pack) => (
                <div
                  key={pack.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white p-2"
                >
                  <input
                    type="number"
                    min="1"
                    value={pack.quantity}
                    onChange={(e) => updatePackPrice(pack.id, "quantity", Number(e.target.value))}
                    placeholder="Qté"
                    className="w-16 min-w-0 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-sm"
                  />
                  <span className="text-xs text-[var(--color-muted)]">pour</span>
                  <input
                    type="number"
                    min="0"
                    value={pack.price}
                    onChange={(e) => updatePackPrice(pack.id, "price", Number(e.target.value))}
                    placeholder="Prix total"
                    className="w-28 min-w-0 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-sm"
                  />
                  <span className="text-xs text-[var(--color-muted)]">GNF</span>
                  {sizes.length > 0 && (
                    <select
                      value={pack.productSizeId ?? ""}
                      onChange={(e) => updatePackPrice(pack.id, "productSizeId", e.target.value || null)}
                      className="rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-sm"
                    >
                      <option value="">Produit entier</option>
                      {sizes.map((s) => (
                        <option key={s.id} value={s.id}>{s.label || "(sans nom)"}</option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={() => removePackPrice(pack.id)}
                    className="ml-auto text-xs text-red-500 hover:text-red-700"
                  >
                    Retirer
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Images */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Images</p>
          <p className="text-xs text-[var(--color-muted)]">
            La première image sera utilisée comme miniature principale.
          </p>
        </div>

        {/* Grille de miniatures */}
        {uploadedImages.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {uploadedImages.map((img, i) => (
              <div key={img} className="group relative">
                <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-[var(--color-border)]">
                  <Image
                    src={`${storageBaseUrl}/${img}`}
                    alt={`Image ${i + 1}`}
                    fill
                    className="object-cover"
                    sizes="96px"
                  />
                  {i === 0 && (
                    <span className="absolute left-1 top-1 rounded-full bg-[var(--color-accent)] px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Principale
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center justify-center gap-1">
                  <button
                    type="button"
                    onClick={() => moveImage(i, -1)}
                    disabled={i === 0}
                    className="text-xs text-[var(--color-muted)] disabled:opacity-30"
                    title="Déplacer à gauche"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadedImages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="text-xs text-red-500 hover:text-red-700"
                    title="Retirer"
                  >
                    ✕
                  </button>
                  <button
                    type="button"
                    onClick={() => moveImage(i, 1)}
                    disabled={i === uploadedImages.length - 1}
                    className="text-xs text-[var(--color-muted)] disabled:opacity-30"
                    title="Déplacer à droite"
                  >
                    →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <label className="block">
          <span className="text-sm font-medium">Ajouter des images</span>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageUpload}
            className="mt-1 w-full rounded-xl border border-[var(--color-border)] px-4 py-3"
          />
        </label>

        {uploadProgress && (
          <p className="text-sm text-[var(--color-muted)]">{uploadProgress}</p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input name="favorite" type="checkbox" defaultChecked={product?.favorite ?? false} />
        <span>Mettre en favori</span>
      </label>

      <div className="flex items-center gap-3 border-t border-[var(--color-border)] pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white disabled:opacity-70"
        >
          {isSubmitting ? "Enregistrement…" : product ? "Enregistrer" : "Créer le produit"}
        </button>
        <a href="/admin/produits" className="text-sm text-[var(--color-muted)]">
          Annuler
        </a>
      </div>
    </form>
  );
}
