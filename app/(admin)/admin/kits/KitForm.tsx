"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { createKit as createKitAction, updateKit as updateKitAction } from "../actions";
import { uploadProductImage as uploadProductImageAction } from "../produits/upload";
import { unwrapAction } from "@/lib/action-result";

// Actions serveur : lèvent une Error au message lisible en cas d'échec (cf. lib/action-result.ts)
const createKit = unwrapAction(createKitAction);
const updateKit = unwrapAction(updateKitAction);
const uploadProductImage = unwrapAction(uploadProductImageAction);

type KitItemInput = {
  id: string; // id réel si existant, "tmp_..." si pas encore enregistré
  productId: string;
  productSizeId: string | null;
  quantity: number;
};

type ProductOption = {
  id: string;
  name: string;
  price: number;
  archived: boolean;
  sizes: { id: string; label: string; price: number }[];
};

function newTempId() {
  return `tmp_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

type KitFormProps = {
  products: ProductOption[];
  storageBaseUrl: string;
  kit?: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    images: string[];
    items: KitItemInput[];
  };
};

export function KitForm({ products, storageBaseUrl, kit }: KitFormProps) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>(kit?.images ?? []);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [items, setItems] = useState<KitItemInput[]>(kit?.items ?? []);

  const productById = new Map(products.map((p) => [p.id, p]));
  const availableProducts = products.filter((p) => !p.archived);

  const itemsTotal = items.reduce((sum, item) => {
    const product = productById.get(item.productId);
    if (!product) return sum;
    const unitPrice = item.productSizeId
      ? product.sizes.find((s) => s.id === item.productSizeId)?.price ?? product.price
      : product.price;
    return sum + unitPrice * item.quantity;
  }, 0);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("images", uploadedImages.join("\n"));
    formData.set(
      "items",
      JSON.stringify(
        items
          .filter((i) => i.productId && i.quantity > 0)
          .map((i) => ({
            id: i.id.startsWith("tmp_") ? undefined : i.id,
            productId: i.productId,
            productSizeId: i.productSizeId,
            quantity: i.quantity,
          })),
      ),
    );

    try {
      if (kit) {
        await updateKit(kit.id, formData);
      } else {
        await createKit(formData);
      }
      router.refresh();
      router.push("/admin/kits");
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

  function addItem(productId: string) {
    const product = productById.get(productId);
    if (!product) return;
    const defaultSizeId = product.sizes.length > 0 ? product.sizes[0].id : null;
    setItems((prev) => [
      ...prev,
      { id: newTempId(), productId, productSizeId: defaultSizeId, quantity: 1 },
    ]);
  }

  function updateItem(itemId: string, field: "productSizeId" | "quantity", value: string | number | null) {
    setItems((prev) => prev.map((i) => (i.id === itemId ? { ...i, [field]: value } : i)));
  }

  function removeItem(itemId: string) {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
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
          defaultValue={kit?.name ?? ""}
          className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Description</span>
        <textarea
          name="description"
          rows={4}
          defaultValue={kit?.description ?? ""}
          className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium">Prix du kit (GNF)</span>
        <input
          name="price"
          type="number"
          min="0"
          required
          defaultValue={kit?.price ?? 0}
          className="w-full max-w-xs rounded-xl border border-[var(--color-border)] px-4 py-3"
        />
      </label>

      {/* Articles du kit */}
      <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-sand)] p-4">
        <div>
          <p className="text-sm font-medium">Articles du kit</p>
          <p className="text-xs text-[var(--color-muted)]">
            Choisissez un produit dans la liste pour l&apos;ajouter, puis précisez sa taille et la quantité.
          </p>
        </div>

        {items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => {
              const product = productById.get(item.productId);
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white p-2"
                >
                  <span className="text-sm font-medium">{product?.name ?? "Produit introuvable"}</span>
                  {product && product.sizes.length > 0 && (
                    <select
                      value={item.productSizeId ?? ""}
                      onChange={(e) => updateItem(item.id, "productSizeId", e.target.value || null)}
                      className="rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-sm"
                    >
                      {product.sizes.map((s) => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  )}
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                    className="w-16 min-w-0 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-sm"
                  />
                  <span className="text-xs text-[var(--color-muted)]">unité(s)</span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="ml-auto text-xs text-red-500 hover:text-red-700"
                  >
                    Retirer
                  </button>
                </div>
              );
            })}
            <p className="text-xs text-[var(--color-muted)]">
              Somme des articles : {itemsTotal.toLocaleString("fr-FR")} GNF
            </p>
          </div>
        )}

        <select
          value=""
          onChange={(e) => {
            if (e.target.value) addItem(e.target.value);
          }}
          className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm text-[var(--color-muted)] outline-none focus:border-[var(--color-accent)]"
        >
          <option value="">+ Ajouter un produit au kit…</option>
          {availableProducts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.price.toLocaleString("fr-FR")} GNF
            </option>
          ))}
        </select>
      </div>

      {/* Images */}
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium">Images</p>
          <p className="text-xs text-[var(--color-muted)]">
            La première image sera utilisée comme miniature principale.
          </p>
        </div>

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

        {uploadProgress && <p className="text-sm text-[var(--color-muted)]">{uploadProgress}</p>}
      </div>

      <div className="flex items-center gap-3 border-t border-[var(--color-border)] pt-4">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white disabled:opacity-70"
        >
          {isSubmitting ? "Enregistrement…" : kit ? "Enregistrer" : "Créer le kit"}
        </button>
        <a href="/admin/kits" className="text-sm text-[var(--color-muted)]">
          Annuler
        </a>
      </div>
    </form>
  );
}