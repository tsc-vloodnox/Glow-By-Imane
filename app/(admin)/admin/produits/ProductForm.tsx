"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createProduct, updateProduct } from "../actions";
import { uploadProductImage } from "./upload";

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
  };
};

export function ProductForm({ categories, storageBaseUrl, product }: ProductFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>(product?.images ?? []);
  const [uploadProgress, setUploadProgress] = useState<string>("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("images", uploadedImages.join("\n"));

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
          <span className="text-sm font-medium">Prix (GNF)</span>
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
          <span className="text-sm font-medium">Stock</span>
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
