"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { createOrder } from "../actions";
import { clearCart, getStoredCartItems, type CartItem } from "@/lib/cart";

export default function CheckoutPageClient() {
  const [items, setItems] = useState<CartItem[]>(() => getStoredCartItems());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (items.length === 0) {
      setMessage("Votre panier est vide.");
      return;
    }

    const formData = new FormData(event.currentTarget);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      quartier: String(formData.get("quartier") || "").trim(),
      comment: String(formData.get("comment") || "").trim() || undefined,
      items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
    };

    setIsSubmitting(true);
    setMessage(null);

    try {
      const redirectUrl = await createOrder(payload);
      clearCart();
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
          <span>{total.toLocaleString("fr-GN")} GNF</span>
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
            className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3"
            placeholder="6XX XX XX XX"
          />
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

        <button
          type="submit"
          disabled={isSubmitting}
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
