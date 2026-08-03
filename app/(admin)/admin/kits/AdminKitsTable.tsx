"use client";

import Image from "next/image";
import { useState, useTransition } from "react";

import { archiveKit, deleteKit, restoreKit, updateKit } from "../actions";
import { uploadProductImage } from "../produits/upload";

type KitItemRow = {
  id: string; // id réel si existant, "tmp_..." si pas encore enregistré
  productId: string;
  productSizeId: string | null;
  quantity: number;
};

type KitRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  archived: boolean;
  images: string[];
  items: KitItemRow[];
  _count: { orderItems: number };
};

type ProductOption = {
  id: string;
  name: string;
  price: number;
  archived: boolean;
  sizes: { id: string; label: string; price: number }[];
};

type AdminKitsTableProps = {
  initialKits: KitRow[];
  products: ProductOption[];
  storageBaseUrl: string;
};

type Filter = "actifs" | "archives";

function newTempId() {
  return `tmp_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

function normalizeItems(items: KitItemRow[]) {
  return items
    .filter((i) => i.productId && i.quantity > 0)
    .map((i) => ({ productId: i.productId, productSizeId: i.productSizeId, quantity: i.quantity }));
}

export function AdminKitsTable({ initialKits, products, storageBaseUrl }: AdminKitsTableProps) {
  const [isPending, startTransition] = useTransition();
  const [kits, setKits] = useState(initialKits);
  const [savedKits, setSavedKits] = useState(initialKits);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("actifs");
  const [search, setSearch] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingImagesId, setEditingImagesId] = useState<string | null>(null);
  const [editingItemsId, setEditingItemsId] = useState<string | null>(null);
  const [itemSearch, setItemSearch] = useState<Record<string, string>>({});
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const productById = new Map(products.map((p) => [p.id, p]));

  function updateField(kitId: string, field: "name" | "description" | "price", value: string | number) {
    setKits((prev) => prev.map((k) => (k.id === kitId ? { ...k, [field]: value } : k)));
  }

  function isDirty(kit: KitRow) {
    const original = savedKits.find((k) => k.id === kit.id);
    if (!original) return false;
    return (
      original.name !== kit.name ||
      (original.description ?? "") !== (kit.description ?? "") ||
      original.price !== kit.price ||
      JSON.stringify(original.images) !== JSON.stringify(kit.images) ||
      JSON.stringify(normalizeItems(original.items)) !== JSON.stringify(normalizeItems(kit.items))
    );
  }

  function updateImages(kitId: string, images: string[]) {
    setKits((prev) => prev.map((k) => (k.id === kitId ? { ...k, images } : k)));
  }

  function moveImage(kitId: string, index: number, direction: -1 | 1) {
    const kit = kits.find((k) => k.id === kitId);
    if (!kit) return;
    const next = [...kit.images];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    updateImages(kitId, next);
  }

  function removeImage(kitId: string, index: number) {
    const kit = kits.find((k) => k.id === kitId);
    if (!kit) return;
    updateImages(kitId, kit.images.filter((_, i) => i !== index));
  }

  async function handleImageUpload(kitId: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadingId(kitId);
    try {
      const results = await Promise.allSettled(Array.from(files).map(uploadProductImage));
      const uploaded = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
      const kit = kits.find((k) => k.id === kitId);
      if (kit && uploaded.length > 0) {
        updateImages(kitId, [...kit.images, ...uploaded]);
      }
      const failures = results.filter((r) => r.status === "rejected").length;
      if (failures > 0) setActionError(`${failures} image(s) non téléchargée(s).`);
    } catch {
      setActionError("Erreur lors du téléchargement des images.");
    } finally {
      setUploadingId(null);
    }
  }

  // ─── Articles du kit ────────────────────────────────────────────────────

  function addItem(kitId: string, productId: string) {
    const product = productById.get(productId);
    if (!product) return;
    const defaultSizeId = product.sizes.length > 0 ? product.sizes[0].id : null;
    setKits((prev) =>
      prev.map((k) =>
        k.id === kitId
          ? {
              ...k,
              items: [
                ...k.items,
                { id: newTempId(), productId, productSizeId: defaultSizeId, quantity: 1 },
              ],
            }
          : k,
      ),
    );
    setItemSearch((prev) => ({ ...prev, [kitId]: "" }));
  }

  function updateItem(
    kitId: string,
    itemId: string,
    field: "productSizeId" | "quantity",
    value: string | number | null,
  ) {
    setKits((prev) =>
      prev.map((k) =>
        k.id === kitId
          ? { ...k, items: k.items.map((i) => (i.id === itemId ? { ...i, [field]: value } : i)) }
          : k,
      ),
    );
  }

  function removeItem(kitId: string, itemId: string) {
    setKits((prev) =>
      prev.map((k) => (k.id === kitId ? { ...k, items: k.items.filter((i) => i.id !== itemId) } : k)),
    );
  }

  // ─── Sauvegarde ─────────────────────────────────────────────────────────

  async function handleSave(kitId: string) {
    const kit = kits.find((k) => k.id === kitId);
    if (!kit) return;

    const formData = new FormData();
    formData.set("name", kit.name);
    formData.set("description", kit.description ?? "");
    formData.set("price", String(kit.price));
    formData.set("images", kit.images.join("\n"));
    formData.set(
      "items",
      JSON.stringify(
        kit.items
          .filter((i) => i.productId && i.quantity > 0)
          .map((i) => ({
            id: i.id.startsWith("tmp_") ? undefined : i.id,
            productId: i.productId,
            productSizeId: i.productSizeId,
            quantity: i.quantity,
          })),
      ),
    );

    setActionError(null);
    setSavingId(kitId);
    startTransition(async () => {
      try {
        const updated = await updateKit(kitId, formData);
        const merged: KitRow = {
          ...kit,
          items: updated.items.map((i) => ({
            id: i.id,
            productId: i.productId,
            productSizeId: i.productSizeId,
            quantity: i.quantity,
          })),
        };
        setKits((prev) => prev.map((k) => (k.id === kitId ? merged : k)));
        setSavedKits((prev) => prev.map((k) => (k.id === kitId ? merged : k)));
        setJustSavedId(kitId);
        setTimeout(() => setJustSavedId((cur) => (cur === kitId ? null : cur)), 2000);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
      } finally {
        setSavingId(null);
      }
    });
  }

  async function handleArchive(kitId: string) {
    startTransition(async () => {
      await archiveKit(kitId);
      setKits((prev) => prev.map((k) => (k.id === kitId ? { ...k, archived: true } : k)));
      setSavedKits((prev) => prev.map((k) => (k.id === kitId ? { ...k, archived: true } : k)));
      setConfirmArchiveId(null);
    });
  }

  async function handleRestore(kitId: string) {
    startTransition(async () => {
      await restoreKit(kitId);
      setKits((prev) => prev.map((k) => (k.id === kitId ? { ...k, archived: false } : k)));
      setSavedKits((prev) => prev.map((k) => (k.id === kitId ? { ...k, archived: false } : k)));
    });
  }

  async function handleDelete(kitId: string) {
    setActionError(null);
    startTransition(async () => {
      try {
        await deleteKit(kitId);
        setKits((prev) => prev.filter((k) => k.id !== kitId));
        setSavedKits((prev) => prev.filter((k) => k.id !== kitId));
        setConfirmDeleteId(null);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Erreur lors de la suppression.");
        setConfirmDeleteId(null);
      }
    });
  }

  const q = search.trim().toLowerCase();

  const visible = kits.filter((k) => {
    if (filter === "actifs" ? k.archived : !k.archived) return false;
    if (q && !k.name.toLowerCase().includes(q) && !(k.description ?? "").toLowerCase().includes(q)) return false;
    return true;
  });

  const activeCount = kits.filter((k) => !k.archived).length;
  const archivedCount = kits.filter((k) => k.archived).length;

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

      {/* Recherche */}
      <div className="relative min-w-48">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[var(--color-muted)]">
          🔍
        </span>
        <input
          type="search"
          placeholder="Rechercher un kit…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-[var(--color-border)] bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-[var(--color-accent)]"
        />
      </div>

      {actionError && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {actionError}
        </p>
      )}

      {visible.length === 0 ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-6 text-sm text-[var(--color-muted)]">
          {search
            ? "Aucun kit ne correspond à cette recherche."
            : filter === "actifs" ? "Aucun kit actif." : "Aucun kit archivé."}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((kit) => {
            const dirty = isDirty(kit);
            const saving = savingId === kit.id && isPending;
            const justSaved = justSavedId === kit.id;
            const thumbnail = kit.images[0] ? `${storageBaseUrl}/${kit.images[0]}` : null;
            const itemsTotal = kit.items.reduce((sum, item) => {
              const product = productById.get(item.productId);
              if (!product) return sum;
              const unitPrice = item.productSizeId
                ? product.sizes.find((s) => s.id === item.productSizeId)?.price ?? product.price
                : product.price;
              return sum + unitPrice * item.quantity;
            }, 0);
            const query = (itemSearch[kit.id] ?? "").trim().toLowerCase();
            const suggestions = query
              ? products.filter((p) => !p.archived && p.name.toLowerCase().includes(query)).slice(0, 6)
              : [];

            return (
              <div
                key={kit.id}
                className={`rounded-xl border bg-white p-4 transition-colors ${
                  kit.archived
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
                      <Image src={thumbnail} alt={kit.name} fill className="object-cover" sizes="56px" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-lg text-[var(--color-muted)]">
                        🎁
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Nom + badge */}
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={kit.name}
                        onChange={(e) => updateField(kit.id, "name", e.target.value)}
                        disabled={kit.archived}
                        placeholder="Nom du kit"
                        className="flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-base font-medium disabled:bg-[var(--color-sand)]"
                      />
                      {kit.archived && (
                        <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          Archivé
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <textarea
                      rows={2}
                      value={kit.description ?? ""}
                      onChange={(e) => updateField(kit.id, "description", e.target.value)}
                      disabled={kit.archived}
                      placeholder="Description"
                      className="mt-2 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:bg-[var(--color-sand)]"
                    />

                    {/* Prix */}
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">
                        <span className="shrink-0 text-[var(--color-muted)]">Prix du kit</span>
                        <input
                          type="number"
                          min="0"
                          inputMode="decimal"
                          value={kit.price}
                          onChange={(e) => updateField(kit.id, "price", Number(e.target.value))}
                          disabled={kit.archived}
                          className="w-full min-w-0 bg-transparent outline-none disabled:text-[var(--color-muted)]"
                        />
                      </label>
                      {kit.items.length > 0 && (
                        <div className="flex items-center rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2 text-xs text-[var(--color-muted)]">
                          Somme des articles : {itemsTotal.toLocaleString("fr-FR")} GNF
                        </div>
                      )}
                    </div>

                    {/* Articles du kit */}
                    {!kit.archived && (
                      <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                        <button
                          type="button"
                          onClick={() => setEditingItemsId(editingItemsId === kit.id ? null : kit.id)}
                          className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-accent)]"
                        >
                          <span>📦</span>
                          {editingItemsId === kit.id ? "Fermer les articles" : `Articles (${kit.items.length})`}
                        </button>

                        {editingItemsId === kit.id && (
                          <div className="mt-3 space-y-3 rounded-xl bg-[var(--color-sand)] p-3">
                            {kit.items.length === 0 ? (
                              <p className="text-xs text-[var(--color-muted)]">Aucun article pour l&apos;instant.</p>
                            ) : (
                              <div className="space-y-2">
                                {kit.items.map((item) => {
                                  const product = productById.get(item.productId);
                                  return (
                                    <div
                                      key={item.id}
                                      className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-border)] bg-white p-2"
                                    >
                                      <span className="text-sm font-medium">
                                        {product?.name ?? "Produit introuvable"}
                                      </span>
                                      {product && product.sizes.length > 0 && (
                                        <select
                                          value={item.productSizeId ?? ""}
                                          onChange={(e) =>
                                            updateItem(kit.id, item.id, "productSizeId", e.target.value || null)
                                          }
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
                                        onChange={(e) =>
                                          updateItem(kit.id, item.id, "quantity", Number(e.target.value))
                                        }
                                        className="w-16 min-w-0 rounded-lg border border-[var(--color-border)] px-2 py-1.5 text-sm"
                                      />
                                      <span className="text-xs text-[var(--color-muted)]">unité(s)</span>
                                      <button
                                        type="button"
                                        onClick={() => removeItem(kit.id, item.id)}
                                        className="ml-auto text-xs text-red-500 hover:text-red-700"
                                      >
                                        Retirer
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Recherche produit à ajouter */}
                            <div className="relative">
                              <input
                                value={itemSearch[kit.id] ?? ""}
                                onChange={(e) =>
                                  setItemSearch((prev) => ({ ...prev, [kit.id]: e.target.value }))
                                }
                                placeholder="+ Ajouter un produit au kit…"
                                className="w-full rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
                              />
                              {suggestions.length > 0 && (
                                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-[var(--color-border)] bg-white shadow-sm">
                                  {suggestions.map((p) => (
                                    <button
                                      key={p.id}
                                      type="button"
                                      onClick={() => addItem(kit.id, p.id)}
                                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-[var(--color-sand)]"
                                    >
                                      <span>{p.name}</span>
                                      <span className="text-xs text-[var(--color-muted)]">
                                        {p.price.toLocaleString("fr-FR")} GNF
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            <p className="text-[10px] text-[var(--color-muted)]">
                              Les articles sont enregistrés avec le bouton &quot;Enregistrer&quot;.
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Images */}
                    {!kit.archived && (
                      <div className="mt-3 border-t border-[var(--color-border)] pt-3">
                        <button
                          type="button"
                          onClick={() => setEditingImagesId(editingImagesId === kit.id ? null : kit.id)}
                          className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-muted)] hover:text-[var(--color-accent)]"
                        >
                          <span>🖼</span>
                          {editingImagesId === kit.id ? "Fermer les images" : `Images (${kit.images.length})`}
                        </button>

                        {editingImagesId === kit.id && (
                          <div className="mt-3 space-y-3">
                            {kit.images.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {kit.images.map((img, i) => (
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
                                    <div className="mt-1 flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => moveImage(kit.id, i, -1)}
                                        disabled={i === 0}
                                        className="text-xs text-[var(--color-muted)] disabled:opacity-20 hover:text-[var(--color-accent)]"
                                        title="Déplacer à gauche"
                                      >
                                        ←
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeImage(kit.id, i)}
                                        className="text-xs text-red-400 hover:text-red-600"
                                        title="Retirer"
                                      >
                                        ✕
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => moveImage(kit.id, i, 1)}
                                        disabled={i === kit.images.length - 1}
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

                            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[var(--color-border)] px-3 py-2.5 text-xs text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]">
                              {uploadingId === kit.id ? (
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
                                disabled={uploadingId === kit.id}
                                onChange={(e) => handleImageUpload(kit.id, e.target.files)}
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
                    {!kit.archived ? (
                      <>
                        {confirmArchiveId === kit.id ? (
                          <span className="flex items-center gap-2 text-sm">
                            <span className="text-[var(--color-muted)]">Archiver ?</span>
                            <button
                              type="button"
                              onClick={() => handleArchive(kit.id)}
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
                            onClick={() => setConfirmArchiveId(kit.id)}
                            className="text-sm text-[var(--color-muted)] hover:text-amber-600"
                          >
                            Archiver
                          </button>
                        )}

                        {kit._count.orderItems === 0 && (
                          confirmDeleteId === kit.id ? (
                            <span className="flex items-center gap-2 text-sm">
                              <span className="text-[var(--color-muted)]">Supprimer ?</span>
                              <button
                                type="button"
                                onClick={() => handleDelete(kit.id)}
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
                              onClick={() => setConfirmDeleteId(kit.id)}
                              className="text-sm text-red-500 hover:text-red-700"
                            >
                              Supprimer
                            </button>
                          )
                        )}
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleRestore(kit.id)}
                        disabled={isPending}
                        className="text-sm text-[var(--color-accent)] hover:underline"
                      >
                        Restaurer
                      </button>
                    )}
                  </div>

                  {!kit.archived && (
                    <button
                      type="button"
                      onClick={() => handleSave(kit.id)}
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
