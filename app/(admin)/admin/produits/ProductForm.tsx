"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { createProduct, updateProduct } from "./actions";
import { uploadProductImage } from "./upload";

type ProductFormProps = {
  categories: { id: string; name: string }[];
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

export function ProductForm({ categories, product }: ProductFormProps) {
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
    if (files.length === 0) {
      return;
    }

    setUploadProgress(`Téléchargement de ${files.length} image${files.length > 1 ? "s" : ""} en cours...`);

    try {
      const results = await Promise.allSettled(files.map((file) => uploadProductImage(file)));
      const uploadedNames = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));

      if (uploadedNames.length > 0) {
        setUploadedImages((current) => [...current, ...uploadedNames]);
      }

      const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
      if (failures.length > 0) {
        setError(`Certaines images n'ont pas pu être téléchargées.`);
      }

      setUploadProgress(uploadedNames.length > 0 ? `${uploadedNames.length} image${uploadedNames.length > 1 ? "s" : ""} téléchargée${uploadedNames.length > 1 ? "s" : ""}.` : "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Échec du téléchargement.");
      setUploadProgress("");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-white p-5 shadow-sm">
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <label className="block space-y-1">
        <span className="text-sm font-medium">Nom</span>
        <input name="name" required defaultValue={product?.name ?? ""} className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3" />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Description</span>
        <textarea name="description" rows={4} defaultValue={product?.description ?? ""} className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3" />
      </label>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Prix (GNF)</span>
          <input name="price" type="number" min="0" required defaultValue={product?.price ?? 0} className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3" />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Stock</span>
          <input name="stock" type="number" min="0" required defaultValue={product?.stock ?? 0} className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3" />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Catégorie</span>
          <select name="categoryId" required defaultValue={product?.categoryId ?? ""} className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3">
            <option value="">Choisir</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="space-y-2">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Téléverser une ou plusieurs images</span>
          <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3" />
        </label>

        {uploadProgress ? <p className="text-sm text-[var(--color-muted)]">{uploadProgress}</p> : null}

        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-3">
          <p className="mb-2 text-sm font-medium">Images enregistrées</p>
          {uploadedImages.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Aucune image pour le moment.</p>
          ) : (
            <ul className="space-y-1 text-sm text-[var(--color-muted)]">
              {uploadedImages.map((image) => (
                <li key={image} className="flex items-center justify-between gap-2">
                  <span>{image}</span>
                  <button type="button" onClick={() => setUploadedImages((current) => current.filter((item) => item !== image))} className="text-xs text-red-600">
                    Retirer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input name="favorite" type="checkbox" defaultChecked={product?.favorite ?? false} />
        <span>Mettre en favori</span>
      </label>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={isSubmitting} className="rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white disabled:opacity-70">
          {isSubmitting ? "Enregistrement..." : product ? "Enregistrer" : "Créer le produit"}
        </button>
        <a href="/admin/produits" className="text-sm text-[var(--color-muted)]">Annuler</a>
      </div>
    </form>
  );
}
