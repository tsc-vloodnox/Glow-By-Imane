"use client";

import imageCompression from "browser-image-compression";
import Link from "next/link";
import { useEffect, useState } from "react";

import { createOrder, refreshCartPrices } from "../actions";
import { useCart } from "../CartContext";
import { resolveDiscountedLineTotal } from "@/lib/pricing";
import { trackPixelEvent } from "@/lib/fbpixel";
import { GIFT_PRINT_FEE } from "@/lib/gift-card";
import { GUINEA_PHONE_PATTERN as PHONE_PATTERN } from "@/lib/order-validation";
import { uploadGiftPhoto } from "./gift-upload";

// Compresse et convertit une image en WebP avant l'upload (photo de carte cadeau).
async function compressImage(file: File): Promise<File> {
  try {
    return await imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1200,
      useWebWorker: true,
      fileType: "image/webp",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return file;
  }
}

export default function CheckoutPageClient() {
  const { items, total, clear, replaceAll } = useCart();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [priceNotice, setPriceNotice] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [isGift, setIsGift] = useState(false);
  const [printRequested, setPrintRequested] = useState(false);
  const [giftPhoneError, setGiftPhoneError] = useState<string | null>(null);
  const [giftPhotoName, setGiftPhotoName] = useState<string | null>(null);
  const [giftPhotoPreview, setGiftPhotoPreview] = useState<string | null>(null);
  const [isUploadingGiftPhoto, setIsUploadingGiftPhoto] = useState(false);
  const [giftPhotoError, setGiftPhotoError] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsRefreshing(false);
      return;
    }

    refreshCartPrices(items)
      .then((result) => {
        replaceAll(result.items);
        if (result.priceChanged) {
          setPriceNotice("Certains prix ont été mis à jour depuis l'ajout au panier. Le total ci-dessous est à jour.");
        }
        if (result.removedKeys.length > 0) {
          setPriceNotice((prev) =>
            [prev, "Un ou plusieurs articles ne sont plus disponibles et ont été retirés."]
              .filter(Boolean)
              .join(" "),
          );
        }
      })
      .catch(() => {})
      .finally(() => setIsRefreshing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGiftPhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setGiftPhotoError(null);
    setIsUploadingGiftPhoto(true);

    try {
      const compressed = await compressImage(file);
      const fileName = await uploadGiftPhoto(compressed);
      setGiftPhotoName(fileName);
      setGiftPhotoPreview(URL.createObjectURL(compressed));
    } catch (err) {
      setGiftPhotoError(err instanceof Error ? err.message : "Échec de l'envoi de la photo.");
    } finally {
      setIsUploadingGiftPhoto(false);
    }
  }

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

    let gift:
      | {
          recipientName: string;
          recipientPhone: string;
          recipientAddress: string;
          message?: string;
          photo?: string;
          printRequested?: boolean;
        }
      | undefined;

    if (isGift) {
      const giftRecipientName = String(formData.get("giftRecipientName") || "").trim();
      const giftRecipientPhone = String(formData.get("giftRecipientPhone") || "").trim();
      const giftRecipientAddress = String(formData.get("giftRecipientAddress") || "").trim();

      if (!PHONE_PATTERN.test(giftRecipientPhone.replace(/\s/g, ""))) {
        setGiftPhoneError("Format attendu : 6XX XX XX XX (numéro guinéen).");
        return;
      }
      setGiftPhoneError(null);

      gift = {
        recipientName: giftRecipientName,
        recipientPhone: giftRecipientPhone,
        recipientAddress: giftRecipientAddress,
        message: String(formData.get("giftMessage") || "").trim() || undefined,
        photo: giftPhotoName || undefined,
        printRequested,
      };
    }

    const payload = {
      name: String(formData.get("name") || "").trim(),
      phone,
      quartier: String(formData.get("quartier") || "").trim(),
      comment: String(formData.get("comment") || "").trim() || undefined,
      items: items.map((item) =>
        item.kind === "kit"
          ? { kind: "kit" as const, kitId: item.kitId!, quantity: item.quantity }
          : {
              kind: "product" as const,
              productId: item.productId!,
              productSizeId: item.productSizeId,
              quantity: item.quantity,
            },
      ),
      gift,
    };

    setIsSubmitting(true);
    setMessage(null);

    try {
      const redirectUrl = await createOrder(payload);
      trackPixelEvent("Lead", {
        value: total,
        currency: "GNF",
      });
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
            <div key={item.cartKey} className="flex items-center justify-between">
              <span>{item.name} x{item.quantity}</span>
              <span>
                {resolveDiscountedLineTotal(
                  item.basePrice,
                  item.activePromotions,
                  item.packPrices,
                  item.quantity,
                  item.originalPrice,
                ).toLocaleString("fr-GN")}{" "}
                GNF
              </span>
            </div>
          ))}
          {isGift && printRequested && (
            <div className="flex items-center justify-between">
              <span>Impression de la carte cadeau</span>
              <span>{GIFT_PRINT_FEE.toLocaleString("fr-GN")} GNF</span>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-[var(--color-border)] pt-3 text-sm font-semibold text-[var(--color-accent)]">
          <span>Total</span>
          <span>
            {isRefreshing
              ? "..."
              : `${(total + (isGift && printRequested ? GIFT_PRINT_FEE : 0)).toLocaleString("fr-GN")} GNF`}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block space-y-1">
          <span className="text-sm font-medium">Nom complet</span>
          <input name="name" required className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3" placeholder="Votre nom" />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Téléphone</span>
          <input
            name="phone"
            required
            type="tel"
            inputMode="numeric"
            onChange={() => setPhoneError(null)}
            className={`w-full rounded-xl border px-4 py-3 ${phoneError ? "border-red-300" : "border-[var(--color-border)]"}`}
            placeholder="6XX XX XX XX"
          />
          {phoneError ? <span className="text-xs text-red-600">{phoneError}</span> : null}
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Quartier</span>
          <input name="quartier" required className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3" placeholder="Ex. Kaloum" />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Commentaire (optionnel)</span>
          <textarea name="comment" rows={3} className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3" placeholder="Instructions de livraison..." />
        </label>

        <label className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3">
          <input
            type="checkbox"
            checked={isGift}
            onChange={(e) => setIsGift(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm font-medium">🎁 Cette commande est un cadeau</span>
        </label>

        {isGift && (
          <div className="space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-blush)]/30 p-4">
            <label className="block space-y-1">
              <span className="text-sm font-medium">Nom du destinataire</span>
              <input
                name="giftRecipientName"
                required
                className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3"
                placeholder="Nom de la personne à qui offrir"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">Numéro du destinataire</span>
              <input
                name="giftRecipientPhone"
                required
                type="tel"
                inputMode="numeric"
                onChange={() => setGiftPhoneError(null)}
                className={`w-full rounded-xl border px-4 py-3 ${giftPhoneError ? "border-red-300" : "border-[var(--color-border)]"}`}
                placeholder="6XX XX XX XX"
              />
              {giftPhoneError ? <span className="text-xs text-red-600">{giftPhoneError}</span> : null}
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">Adresse de livraison du destinataire</span>
              <input
                name="giftRecipientAddress"
                required
                className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3"
                placeholder="Quartier + point de repère du destinataire"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">Message personnalisé (optionnel)</span>
              <textarea
                name="giftMessage"
                rows={3}
                className="w-full rounded-xl border border-[var(--color-border)] px-4 py-3"
                placeholder="Un petit mot pour accompagner le cadeau..."
              />
            </label>

            <label className="block space-y-1">
              <span className="text-sm font-medium">Photo (optionnelle)</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleGiftPhotoChange}
                disabled={isUploadingGiftPhoto}
                className="w-full text-sm"
              />
              {isUploadingGiftPhoto ? (
                <span className="text-xs text-[var(--color-muted)]">Envoi de la photo...</span>
              ) : null}
              {giftPhotoError ? <span className="text-xs text-red-600">{giftPhotoError}</span> : null}
              {giftPhotoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={giftPhotoPreview} alt="Aperçu de la photo cadeau" className="mt-2 h-24 w-24 rounded-xl object-cover" />
              ) : null}
            </label>

            <label className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-white px-4 py-3">
              <input
                type="checkbox"
                checked={printRequested}
                onChange={(e) => setPrintRequested(e.target.checked)}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium">
                🖨️ Faire imprimer la carte ({GIFT_PRINT_FEE.toLocaleString("fr-GN")} GNF)
              </span>
            </label>
          </div>
        )}

        <p className="rounded-xl bg-[var(--color-blush)]/60 px-4 py-3 text-xs text-[var(--color-muted)]">
          Vous ne payez rien maintenant. Imane vous contactera sur WhatsApp pour confirmer la disponibilité et les frais de livraison.
        </p>

        <button
          type="submit"
          disabled={isSubmitting || isRefreshing || isUploadingGiftPhoto}
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