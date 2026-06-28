// Destination : app/(shop)/commande/CheckoutPageClient.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { createOrder, refreshCartPrices } from "../actions";
import { useCart } from "../CartContext";

// Numéros guinéens : 9 chiffres commençant par 6, avec ou sans indicatif +224
const PHONE_PATTERN = /^(\+?224)?6\d{8}$/;

export default function CheckoutPageClient() {
  const { items, total, clear, replaceAll } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [priceNotice, setPriceNotice] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Revalide les prix côté serveur dès l'arrivée sur le checkout, pour que
  // le total affiché ici corresponde exactement à ce qui sera facturé
  // (avant : le prix restait figé au moment de l'ajout au panier).
  useEffect(() => {
    if (items.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsRefreshing(false);
      return;
    }

    refreshCartPrices(
      items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
      })),
    )
      .then((result) => {
        const updatedCartItems = result.items.map((item) => ({
          productId: item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        }));

        replaceAll(updatedCartItems);

        if (result.priceChanged) {
          setPriceNotice("Certains prix ont été mis à jour depuis l'ajout au panier. Le total ci-dessous est à jour.");
        }
        if (result.removedProductIds.length > 0) {
          setPriceNotice((prev) =>
            [prev, "Un ou plusieurs articles ne sont plus disponibles et ont été retirés."]
              .filter(Boolean)
              .join(" "),
          );
        }
      })
      .catch(() => {
        // En cas d'échec réseau, on garde les valeurs locales plutôt que de bloquer la page
      })
      .finally(() => setIsRefreshing(false));
    // On ne veut revalider qu'une fois à l'arrivée sur la page, pas à chaque changement d'items
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (items.length === 0) {
      setMessage("Votre panier est vide.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const phone = String(formData.get("phone") || "").trim();

    if (!PHONE_PATTERN.test(phone.replace(/\s/g, ""))) {
      setPhoneError("Format attendu : 6XX XX XX XX (numéro guinéen).");
      return;
    }
    setPhoneError(null);

    const payload = {
      name: String(formData.get("name") || "").trim(),
      phone,
      quartier: String(formData.get("quartier") || "").trim(),
      comment: String(formData.get("comment") || "").trim() || undefined,
      items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    };

    setIsSubmitting(true);
    setMessage(null);

    try {
      const redirectUrl = await createOrder(payload);
      clear();
      window.location.href = redirectUrl;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Une erreur est survenue.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="font-serif text-3xl text-[var(--color-foreground)]">Votre commande</h1>

      <p className="rounded-2xl bg-[var(--color-blush)] p-4 text-sm text-[var(--color-muted)]">
        Remplissez vos informations. Une fois le formulaire envoyé, vous serez redirigé vers WhatsApp pour confirmer avec Imane.
      </p>

      {priceNotice ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{priceNotice}</p>
      ) : null}

      {message ? <p className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{message}</p> : null}

      <div className="rounded-2xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-muted)]">Résumé</p>
        <div className="mt-3 space-y-2 text-sm">
          {items.map((item) => (
            <div key={item.productId} className="flex items-center justify-between">
              <span>{item.name} x{item.quantity}</span>
              <span>{(item.price * item.quantity).toLocaleString("fr-GN")} GNF</span>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3 text-sm font-semibold text-[var(--color-accent)]">
          <span>Total</span>
          <span>{isRefreshing ? "..." : `${total.toLocaleString("fr-GN")} GNF`}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Nom complet</span>
          <input
            name="name"
            required
            className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3"
            placeholder="Votre nom"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Téléphone</span>
          <input
            name="phone"
            required
            type="tel"
            inputMode="numeric"
            onChange={() => setPhoneError(null)}
            className={`w-full rounded-xl border px-4 py-3 ${
              phoneError ? "border-red-300" : "border-[var(--color-border)]"
            }`}
            placeholder="6XX XX XX XX"
          />
          {phoneError ? <span className="text-xs text-red-600">{phoneError}</span> : null}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Quartier</span>
          <input
            name="quartier"
            required
            className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3"
            placeholder="Ex. Kaloum"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Commentaire (optionnel)</span>
          <textarea
            name="comment"
            rows={3}
            className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3"
            placeholder="Instructions de livraison..."
          />
        </label>

        <p className="rounded-xl bg-[var(--color-blush)]/60 px-4 py-3 text-xs text-[var(--color-muted)]">
          Vous ne payez rien maintenant. Imane vous contactera sur WhatsApp pour confirmer la disponibilité et les frais de livraison.
        </p>

        <button
          type="submit"
          disabled={isSubmitting || isRefreshing}
          className="w-full rounded-full bg-[var(--color-accent)] px-6 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? "Envoi en cours..." : "Envoyer sur WhatsApp"}
        </button>
      </form>

      <Link href="/panier" className="block text-center text-sm text-[var(--color-muted)]">
        Retour au panier
      </Link>
    </div>
  );
}
