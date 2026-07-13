// Destination : app/admin/categories/CategoriesClient.tsx
"use client";

import { useRef, useState, useTransition } from "react";

import { createCategory, deleteCategory, renameCategory } from "./actions";

type Category = {
  id: string;
  name: string;
  productCount: number;
};

export function CategoriesClient({ categories: initial }: { categories: Category[] }) {
  const [categories, setCategories] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const editRef = useRef<HTMLInputElement>(null);

  const clearError = () => setError(null);

  // Création
  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    clearError();

    startTransition(async () => {
      try {
        await createCategory(trimmed);
        setCategories((prev) => [
          ...prev,
          { id: crypto.randomUUID(), name: trimmed, productCount: 0 },
        ].sort((a, b) => a.name.localeCompare(b.name)));
        setNewName("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de la création.");
      }
    });
  };

  // Début d'édition inline
  const startEdit = (category: Category) => {
    setEditingId(category.id);
    setEditValue(category.name);
    clearError();
    setTimeout(() => editRef.current?.select(), 0);
  };

  // Sauvegarde renommage
  const handleRename = (id: string) => {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    clearError();

    startTransition(async () => {
      try {
        await renameCategory(id, trimmed);
        setCategories((prev) =>
          prev
            .map((c) => (c.id === id ? { ...c, name: trimmed } : c))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        setEditingId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors du renommage.");
      }
    });
  };

  // Suppression
  const handleDelete = (category: Category) => {
    if (category.productCount > 0) {
      setError(
        `Impossible de supprimer "${category.name}" : ${category.productCount} produit${category.productCount > 1 ? "s" : ""} actif${category.productCount > 1 ? "s" : ""} associé${category.productCount > 1 ? "s" : ""}. Archivez-les d'abord.`,
      );
      return;
    }

    if (!window.confirm(`Supprimer la catégorie "${category.name}" ?`)) return;
    clearError();

    startTransition(async () => {
      try {
        await deleteCategory(category.id);
        setCategories((prev) => prev.filter((c) => c.id !== category.id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de la suppression.");
      }
    });
  };

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {/* Formulaire de création */}
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          placeholder="Nouvelle catégorie..."
          className="min-w-0 flex-1 rounded-xl border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={isPending || !newName.trim()}
          className="rounded-xl bg-[var(--color-accent)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Ajouter
        </button>
      </div>

      {/* Liste */}
      {categories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted)]">
          Aucune catégorie pour le moment.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {categories.map((category) => (
            <div
              key={category.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3"
            >
              {editingId === category.id ? (
                // Mode édition inline
                <input
                  ref={editRef}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename(category.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  className="min-w-0 flex-1 rounded-lg border border-[var(--color-accent)]/40 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/30"
                  autoFocus
                />
              ) : (
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{category.name}</span>
                  <span className="ml-2 text-xs text-[var(--color-muted)]">
                    {category.productCount} produit{category.productCount > 1 ? "s" : ""}
                  </span>
                </div>
              )}

              <div className="flex shrink-0 items-center gap-2">
                {editingId === category.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleRename(category.id)}
                      disabled={isPending}
                      className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                    >
                      Sauvegarder
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)]"
                    >
                      Annuler
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => startEdit(category)}
                      className="rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-accent)]"
                    >
                      Renommer
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(category)}
                      disabled={isPending}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 disabled:opacity-50"
                    >
                      Supprimer
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
