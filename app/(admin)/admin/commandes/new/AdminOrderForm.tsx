"use client";

import { useState, useTransition } from "react";
import { createAdminOrder } from "../actions";

type Product = { id: string; name: string; price: number; categoryId: string };

type LineItem = { productId: string; quantity: number; unitPrice: number; name: string };

type Props = { products: Product[] };

export function AdminOrderForm({ products }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<LineItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");

  function addLine(productId: string) {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === productId);
      if (existing) return prev.map((l) => l.productId === productId ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, { productId, quantity: 1, unitPrice: product.price, name: product.name }];
    });
  }

  function updateLine(productId: string, field: "quantity" | "unitPrice", value: number) {
    setLines((prev) =>
      prev.map((l) => l.productId === productId ? { ...l, [field]: Math.max(field === "quantity" ? 1 : 0, value) } : l),
    );
  }

  function removeLine(productId: string) {
    setLines((prev) => prev.filter((l) => l.productId !== productId));
  }

  const estimatedTotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const finalTotal = Math.max(0, estimatedTotal - discountAmount);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lines.length === 0) { setError("Ajoutez au moins un article."); return; }
    setError(null);

    const formData = new FormData(event.currentTarget);
    formData.set("items", JSON.stringify(lines.map(({ productId, quantity, unitPrice }) => ({ productId, quantity, unitPrice }))));
    formData.set("discountAmount", String(discountAmount));
    formData.set("discountReason", discountReason);

    startTransition(async () => {
      try {
        await createAdminOrder(formData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de la création.");
      }
    });
  }

  // Grouper les produits par catégorie pour le select
  const productsByCategory = products.reduce<Record<string, Product[]>>((acc, p) => {
    const key = p.categoryId;
    if (!acc[key]) acc[key] = [];
    acc[key].push(p);
    return acc;
  }, {});

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      {/* Infos client */}
      <section className="rounded-xl border border-[var(--color-border)] bg-white p-4 space-y-3">
        <h2 className="font-medium">Client</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Nom</span>
            <input name="name" required className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Téléphone</span>
            <input name="phone" type="tel" required className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm" placeholder="620000000" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Quartier</span>
            <input name="quartier" required className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Source</span>
            <select name="source" className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm">
              <option value="whatsapp">WhatsApp</option>
              <option value="admin">Saisie directe</option>
            </select>
          </label>
        </div>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Commentaire (optionnel)</span>
          <textarea name="comment" rows={2} className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm" />
        </label>
      </section>

      {/* Articles */}
      <section className="rounded-xl border border-[var(--color-border)] bg-white p-4 space-y-3">
        <h2 className="font-medium">Articles</h2>

        {/* Picker produit */}
        <select
          onChange={(e) => { if (e.target.value) { addLine(e.target.value); e.target.value = ""; } }}
          className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm text-[var(--color-muted)]"
        >
          <option value="">+ Ajouter un produit…</option>
          {Object.entries(productsByCategory).map(([catId, prods]) => (
            <optgroup key={catId} label={prods[0]?.name.split(" ")[0] ?? catId}>
              {prods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.price.toLocaleString("fr-GN")} GNF
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {/* Lignes */}
        {lines.length > 0 && (
          <ul className="divide-y divide-[var(--color-border)]">
            {lines.map((line) => (
              <li key={line.productId} className="flex items-center gap-3 py-2.5">
                <span className="flex-1 text-sm font-medium truncate">{line.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <label className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
                    Qté
                    <input
                      type="number" min="1" value={line.quantity}
                      onChange={(e) => updateLine(line.productId, "quantity", Number(e.target.value))}
                      className="w-14 rounded-lg border border-[var(--color-border)] px-2 py-1 text-center text-sm"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-xs text-[var(--color-muted)]">
                    Prix
                    <input
                      type="number" min="0" value={line.unitPrice}
                      onChange={(e) => updateLine(line.productId, "unitPrice", Number(e.target.value))}
                      className="w-24 rounded-lg border border-[var(--color-border)] px-2 py-1 text-sm"
                    />
                  </label>
                  <span className="w-24 text-right text-sm font-medium">
                    {(line.unitPrice * line.quantity).toLocaleString("fr-GN")}
                  </span>
                  <button type="button" onClick={() => removeLine(line.productId)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {lines.length === 0 && (
          <p className="text-sm text-[var(--color-muted)]">Aucun article ajouté.</p>
        )}
      </section>

      {/* Remise + totaux */}
      <section className="rounded-xl border border-[var(--color-border)] bg-white p-4 space-y-3">
        <h2 className="font-medium">Totaux</h2>
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-[var(--color-muted)]">Sous-total</dt>
            <dd>{estimatedTotal.toLocaleString("fr-GN")} GNF</dd>
          </div>
        </dl>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Remise (GNF)</span>
            <input
              type="number" min="0" max={estimatedTotal}
              value={discountAmount}
              onChange={(e) => setDiscountAmount(Math.min(Number(e.target.value), estimatedTotal))}
              className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Raison de la remise</span>
            <input
              type="text" value={discountReason}
              onChange={(e) => setDiscountReason(e.target.value)}
              placeholder="Accord WhatsApp, commande groupée…"
              className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm"
            />
          </label>
        </div>

        <div className="flex justify-between border-t border-[var(--color-border)] pt-3 font-semibold">
          <span>Total final</span>
          <span className="text-[var(--color-accent)]">{finalTotal.toLocaleString("fr-GN")} GNF</span>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending || lines.length === 0}
          className="rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white disabled:opacity-60"
        >
          {isPending ? "Création…" : "Créer la commande"}
        </button>
        <a href="/admin/commandes" className="text-sm text-[var(--color-muted)]">Annuler</a>
      </div>
    </form>
  );
}
