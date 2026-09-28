"use client";

import { useState, useTransition } from "react";

import {
  createLivreur as createLivreurAction,
  toggleLivreurActive as toggleLivreurActiveAction,
  updateLivreur as updateLivreurAction,
} from "../actions";
import { unwrapAction } from "@/lib/action-result";

// Actions serveur : lèvent une Error au message lisible en cas d'échec (cf. lib/action-result.ts)
const createLivreur = unwrapAction(createLivreurAction);
const toggleLivreurActive = unwrapAction(toggleLivreurActiveAction);
const updateLivreur = unwrapAction(updateLivreurAction);

type LivreurRow = {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  active: boolean;
  pendingDeliveries: number;
};

type AdminLivreursTableProps = {
  initialLivreurs: LivreurRow[];
};

export function AdminLivreursTable({ initialLivreurs }: AdminLivreursTableProps) {
  const [isPending, startTransition] = useTransition();
  const [livreurs, setLivreurs] = useState(initialLivreurs);
  const [savedLivreurs, setSavedLivreurs] = useState(initialLivreurs);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [justSavedId, setJustSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");

  function updateField(livreurId: string, field: "name" | "phone" | "notes", value: string) {
    setLivreurs((prev) => prev.map((l) => (l.id === livreurId ? { ...l, [field]: value } : l)));
  }

  function isDirty(livreur: LivreurRow) {
    const original = savedLivreurs.find((l) => l.id === livreur.id);
    if (!original) return false;
    return (
      original.name !== livreur.name ||
      original.phone !== livreur.phone ||
      (original.notes ?? "") !== (livreur.notes ?? "")
    );
  }

  async function handleSave(livreurId: string) {
    const livreur = livreurs.find((l) => l.id === livreurId);
    if (!livreur) return;

    const formData = new FormData();
    formData.set("name", livreur.name);
    formData.set("phone", livreur.phone);
    formData.set("notes", livreur.notes ?? "");

    setError(null);
    setSavingId(livreurId);
    startTransition(async () => {
      try {
        await updateLivreur(livreurId, formData);
        setSavedLivreurs((prev) => prev.map((l) => (l.id === livreurId ? livreur : l)));
        setJustSavedId(livreurId);
        setTimeout(() => setJustSavedId((cur) => (cur === livreurId ? null : cur)), 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
      } finally {
        setSavingId(null);
      }
    });
  }

  async function handleToggleActive(livreurId: string, active: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        await toggleLivreurActive(livreurId, active);
        setLivreurs((prev) => prev.map((l) => (l.id === livreurId ? { ...l, active } : l)));
        setSavedLivreurs((prev) => prev.map((l) => (l.id === livreurId ? { ...l, active } : l)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de la mise à jour.");
      }
    });
  }

  function handleCreate() {
    const name = newName.trim();
    const phone = newPhone.trim();
    if (!name || !phone) {
      setError("Nom et téléphone requis.");
      return;
    }

    const formData = new FormData();
    formData.set("name", name);
    formData.set("phone", phone);

    setError(null);
    startTransition(async () => {
      try {
        const created = await createLivreur(formData);
        const row: LivreurRow = {
          id: created.id,
          name: created.name,
          phone: created.phone,
          notes: created.notes,
          active: created.active,
          pendingDeliveries: 0,
        };
        setLivreurs((prev) => [row, ...prev]);
        setSavedLivreurs((prev) => [row, ...prev]);
        setNewName("");
        setNewPhone("");
        setShowNewForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de la création.");
      }
    });
  }

  const activeLivreurs = livreurs.filter((l) => l.active);
  const inactiveLivreurs = livreurs.filter((l) => !l.active);

  function renderRow(livreur: LivreurRow) {
    const dirty = isDirty(livreur);
    const saving = savingId === livreur.id && isPending;
    const justSaved = justSavedId === livreur.id;

    return (
      <div
        key={livreur.id}
        className={`rounded-xl border bg-white p-4 transition-colors ${
          !livreur.active
            ? "border-[var(--color-border)] opacity-60"
            : dirty
            ? "border-[var(--color-accent)]"
            : "border-[var(--color-border)]"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={livreur.name}
            onChange={(e) => updateField(livreur.id, "name", e.target.value)}
            placeholder="Nom"
            className="min-w-32 flex-1 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium"
          />
          <input
            value={livreur.phone}
            onChange={(e) => updateField(livreur.id, "phone", e.target.value)}
            placeholder="Téléphone"
            className="w-36 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
          />
          {livreur.pendingDeliveries > 0 && (
            <span className="shrink-0 rounded-full bg-[var(--color-sand)] px-2.5 py-1 text-xs font-medium text-[var(--color-muted)]">
              {livreur.pendingDeliveries} en cours
            </span>
          )}
        </div>

        <input
          value={livreur.notes ?? ""}
          onChange={(e) => updateField(livreur.id, "notes", e.target.value)}
          placeholder="Notes (zone habituelle, moto, disponibilités…)"
          className="mt-2 w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"
        />

        <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3">
          <button
            type="button"
            onClick={() => handleToggleActive(livreur.id, !livreur.active)}
            disabled={isPending}
            className={`text-sm ${
              livreur.active
                ? "text-[var(--color-muted)] hover:text-amber-600"
                : "text-[var(--color-accent)] hover:underline"
            }`}
          >
            {livreur.active ? "Désactiver" : "Réactiver"}
          </button>

          <button
            type="button"
            onClick={() => handleSave(livreur.id)}
            disabled={!dirty || saving}
            className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
          >
            {saving ? "Enregistrement…" : justSaved ? "Enregistré ✓" : "Enregistrer"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Nouveau livreur */}
      {!showNewForm ? (
        <button
          type="button"
          onClick={() => setShowNewForm(true)}
          className="rounded-full bg-[var(--color-accent)] px-5 py-2.5 text-sm font-medium text-white"
        >
          + Nouveau livreur
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-sand)] p-3">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom"
            autoFocus
            className="min-w-32 flex-1 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
          <input
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="Téléphone"
            className="w-36 rounded-lg border border-[var(--color-border)] bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={isPending}
            className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Créer
          </button>
          <button
            type="button"
            onClick={() => { setShowNewForm(false); setNewName(""); setNewPhone(""); }}
            className="text-sm text-[var(--color-muted)]"
          >
            Annuler
          </button>
        </div>
      )}

      {/* Actifs */}
      <div>
        <p className="mb-2 text-sm font-medium text-[var(--color-muted)]">
          Actifs ({activeLivreurs.length})
        </p>
        {activeLivreurs.length === 0 ? (
          <p className="rounded-xl border border-[var(--color-border)] bg-white p-6 text-sm text-[var(--color-muted)]">
            Aucun livreur actif.
          </p>
        ) : (
          <div className="flex flex-col gap-3">{activeLivreurs.map(renderRow)}</div>
        )}
      </div>

      {/* Inactifs */}
      {inactiveLivreurs.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-[var(--color-muted)]">
            Désactivés ({inactiveLivreurs.length})
          </p>
          <div className="flex flex-col gap-3">{inactiveLivreurs.map(renderRow)}</div>
        </div>
      )}
    </div>
  );
}
