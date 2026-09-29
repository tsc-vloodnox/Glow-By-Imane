"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { unwrapAction } from "@/lib/action-result";
import { GUINEA_PHONE_PATTERN } from "@/lib/order-validation";
import { resolveDiscountedLineTotal, type ActivePromotion } from "@/lib/pricing";
import { ProductImage } from "../components/ProductImage";
import { createWholesaleRequest as createWholesaleRequestAction } from "./actions";

// Action serveur : lève une Error au message lisible en cas d'échec (cf. lib/action-result.ts)
const createWholesaleRequest = unwrapAction(createWholesaleRequestAction);

export type WholesaleProduct = {
  id: string;
  name: string;
  category: string;
  image: string | null;
  price: number;
  originalPrice: number | null;
  activePromotions: ActivePromotion[];
  sizes: { id: string; label: string; price: number }[];
  packPrices: { quantity: number; price: number; productSizeId: string | null }[];
};

/** Une ligne commandable : un produit sans taille, ou une taille précise. */
type Line = {
  key: string;
  productId: string;
  productSizeId: string | null;
  label: string;
  category: string;
  image: string | null;
  lineTotal: (quantity: number) => number;
};

function toLines(products: WholesaleProduct[]): Line[] {
  return products.flatMap((product): Line[] => {
    const packsFor = (sizeId: string | null) =>
      product.packPrices.filter((p) => p.productSizeId === sizeId).map((p) => ({ quantity: p.quantity, price: p.price }));

    if (product.sizes.length === 0) {
      return [{
        key: product.id,
        productId: product.id,
        productSizeId: null,
        label: product.name,
        category: product.category,
        image: product.image,
        lineTotal: (q: number) =>
          resolveDiscountedLineTotal(product.price, product.activePromotions, packsFor(null), q, product.originalPrice),
      }];
    }
    return product.sizes.map((size) => ({
      key: `${product.id}:${size.id}`,
      productId: product.id,
      productSizeId: size.id,
      label: `${product.name} — ${size.label}`,
      category: product.category,
      image: product.image,
      // Pas de promotion par taille (même règle que la boutique)
      lineTotal: (q: number) => resolveDiscountedLineTotal(size.price, [], packsFor(size.id), q),
    }));
  });
}

const formatGNF = (value: number) => `${value.toLocaleString("fr-GN")} GNF`;

export function WholesaleRequestClient({ products, minQuantity }: { products: WholesaleProduct[]; minQuantity: number }) {
  const lines = useMemo(() => toLines(products), [products]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  // Prix unitaire souhaité par le revendeur (facultatif), par ligne
  const [requested, setRequested] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setQuantity = (key: string, value: number) =>
    setQuantities((prev) => {
      const next = { ...prev };
      const clean = Number.isFinite(value) ? Math.min(Math.max(Math.floor(value), 0), 10_000) : 0;
      if (clean > 0) next[key] = clean;
      else delete next[key];
      return next;
    });

  const setRequestedPrice = (key: string, value: string) =>
    setRequested((prev) => {
      const next = { ...prev };
      const n = Math.floor(Number(value.replace(/\s/g, "")));
      if (Number.isFinite(n) && n > 0) next[key] = Math.min(n, 100_000_000);
      else delete next[key];
      return next;
    });

  const selected = lines.filter((line) => quantities[line.key]);
  const totalQuantity = selected.reduce((sum, line) => sum + quantities[line.key], 0);
  const indicativeTotal = selected.reduce((sum, line) => sum + line.lineTotal(quantities[line.key]), 0);
  // Total selon les prix souhaités (prix indicatif pour les lignes sans proposition)
  const hasRequested = selected.some((line) => requested[line.key]);
  const requestedTotal = selected.reduce(
    (sum, line) =>
      sum + (requested[line.key] ? requested[line.key] * quantities[line.key] : line.lineTotal(quantities[line.key])),
    0,
  );
  const missing = Math.max(minQuantity - totalQuantity, 0);

  const query = search.trim().toLowerCase();
  const visible = query
    ? lines.filter((line) => `${line.label} ${line.category}`.toLowerCase().includes(query))
    : lines;
  const grouped = visible.reduce<Record<string, Line[]>>((acc, line) => {
    (acc[line.category] ??= []).push(line);
    return acc;
  }, {});

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (missing > 0) return;

    const formData = new FormData(event.currentTarget);
    const phone = String(formData.get("phone") ?? "").trim();
    if (!GUINEA_PHONE_PATTERN.test(phone.replace(/\s/g, ""))) {
      setPhoneError("Format attendu : 6XX XX XX XX (numéro guinéen).");
      return;
    }
    setPhoneError(null);
    setError(null);
    setIsSubmitting(true);

    try {
      const whatsappUrl = await createWholesaleRequest({
        name: String(formData.get("name") ?? "").trim(),
        phone,
        businessName: String(formData.get("businessName") ?? "").trim(),
        quartier: String(formData.get("quartier") ?? "").trim(),
        comment: String(formData.get("comment") ?? "").trim(),
        items: selected.map((line) => ({
          productId: line.productId,
          productSizeId: line.productSizeId,
          quantity: quantities[line.key],
          requestedUnitPrice: requested[line.key] ?? null,
        })),
      });
      window.location.assign(whatsappUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-cream)] pb-40 text-[var(--foreground)]">
      <header className="px-4 pb-4 pt-6">
        <Link href="/" className="text-sm text-[var(--color-muted)] hover:text-[var(--color-accent)]">
          ← Boutique
        </Link>
        <h1 className="mt-2 font-serif text-3xl text-[var(--color-accent)]">Espace revendeurs</h1>
        <ul className="mt-3 space-y-1 text-sm text-[var(--color-muted)]">
          <li>• À partir de {minQuantity} unités, tous produits confondus.</li>
          <li>• Prix indicatifs dégressifs : proposez votre prix par produit si vous le souhaitez, le tarif final se fixe ensemble sur WhatsApp.</li>
          <li>• Quantités libres, même au-delà du stock : nous confirmons la disponibilité et les délais.</li>
          <li>• Aucun paiement en ligne : acompte éventuel à convenir directement.</li>
        </ul>
      </header>

      <div className="sticky top-0 z-10 bg-[var(--color-cream)]/95 px-4 py-2 backdrop-blur">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un produit"
          className="w-full rounded-full border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm"
        />
      </div>

      <main className="space-y-6 px-4 pt-2">
        {Object.keys(grouped).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[var(--color-border)] p-6 text-center text-sm text-[var(--color-muted)]">
            Aucun produit ne correspond à votre recherche.
          </p>
        ) : (
          Object.entries(grouped).map(([category, categoryLines]) => (
            <section key={category}>
              <h2 className="mb-2 border-b border-[var(--color-border)] pb-1 font-serif text-lg text-[var(--color-accent)]">
                {category}
              </h2>
              <ul className="space-y-2">
                {categoryLines.map((line) => {
                  const quantity = quantities[line.key] ?? 0;
                  const unitHint = Math.round(line.lineTotal(Math.max(quantity, minQuantity)) / Math.max(quantity, minQuantity));
                  return (
                    <li key={line.key} className={`rounded-2xl border bg-white p-2.5 ${
                      quantity ? "border-[var(--color-accent)]" : "border-[var(--color-border)]"
                    }`}>
                      <div className="flex items-center gap-3">
                        <ProductImage imageName={line.image} alt={line.label} className="h-14 w-14 shrink-0 rounded-xl" />
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-2 text-sm font-medium">{line.label}</p>
                          <p className="text-xs text-[var(--color-muted)]">
                            {quantity ? `${formatGNF(line.lineTotal(quantity))} indicatif` : `≈ ${formatGNF(unitHint)} / unité`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button type="button" aria-label={`Retirer une unité de ${line.label}`}
                            onClick={() => setQuantity(line.key, quantity - 1)} disabled={!quantity}
                            className="h-8 w-8 rounded-full text-lg text-[var(--color-accent)] disabled:opacity-30">−</button>
                          <input
                            type="number" inputMode="numeric" min={0} max={10000}
                            aria-label={`Quantité de ${line.label}`}
                            value={quantity || ""}
                            placeholder="0"
                            onChange={(e) => setQuantity(line.key, Number(e.target.value))}
                            className="w-14 rounded-lg border border-[var(--color-border)] px-1 py-1 text-center text-sm"
                          />
                          <button type="button" aria-label={`Ajouter une unité de ${line.label}`}
                            onClick={() => setQuantity(line.key, quantity + 1)}
                            className="h-8 w-8 rounded-full text-lg text-[var(--color-accent)]">+</button>
                        </div>
                      </div>
                      {quantity ? (
                        <label className="mt-2 flex items-center justify-end gap-2 text-xs text-[var(--color-muted)]">
                          Prix souhaité / unité (facultatif)
                          <input
                            type="number" inputMode="numeric" min={1}
                            aria-label={`Prix souhaité par unité pour ${line.label}`}
                            value={requested[line.key] || ""}
                            placeholder={String(Math.round(line.lineTotal(quantity) / quantity))}
                            onChange={(e) => setRequestedPrice(line.key, e.target.value)}
                            className="w-24 rounded-lg border border-[var(--color-border)] px-2 py-1 text-right text-sm text-[var(--foreground)]"
                          />
                          <span>GNF</span>
                        </label>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}

        <form id="demande" onSubmit={handleSubmit} className="space-y-3 rounded-2xl border border-[var(--color-border)] bg-white p-4">
          <h2 className="font-serif text-xl text-[var(--color-accent)]">Vos informations</h2>
          {error ? <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
          <input name="name" required maxLength={80} placeholder="Votre nom"
            className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3" />
          <input name="businessName" maxLength={120} placeholder="Nom de votre boutique (facultatif)"
            className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3" />
          <div>
            <input name="phone" required inputMode="tel" placeholder="Téléphone (6XX XX XX XX)"
              className={`w-full rounded-xl border px-4 py-3 ${phoneError ? "border-red-300" : "border-[var(--color-border)]"}`} />
            {phoneError ? <span className="text-xs text-red-600">{phoneError}</span> : null}
          </div>
          <input name="quartier" required maxLength={120} placeholder="Ville / quartier"
            className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3" />
          <textarea name="comment" maxLength={1000} rows={3} placeholder="Précisions (délais souhaités, conditionnement…)"
            className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3" />
        </form>
      </main>

      {/* Récapitulatif fixe */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--color-border)] bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0 text-sm">
            <p className="font-semibold">
              {totalQuantity} unité{totalQuantity > 1 ? "s" : ""} · ≈ {formatGNF(indicativeTotal)}
            </p>
            <p className="text-xs text-[var(--color-muted)]">
              {missing > 0
                ? `Encore ${missing} unité${missing > 1 ? "s" : ""} pour une commande en gros`
                : hasRequested
                  ? `Selon vos prix : ${formatGNF(requestedTotal)}`
                  : "Prix indicatif, à confirmer sur WhatsApp"}
            </p>
          </div>
          <button type="submit" form="demande" disabled={missing > 0 || isSubmitting}
            className="shrink-0 rounded-2xl bg-[var(--color-accent)] px-5 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40">
            {isSubmitting ? "Envoi…" : "Envoyer la demande"}
          </button>
        </div>
      </div>
    </div>
  );
}
