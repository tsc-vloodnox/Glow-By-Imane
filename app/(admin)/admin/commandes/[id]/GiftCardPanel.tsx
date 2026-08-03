"use client";

import { useState, useTransition } from "react";

import { catalogPath } from "@/lib/images";
import { buildDefaultGiftMessage, giftCardUrl } from "@/lib/gift-card";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { uploadProductImage } from "../../produits/upload";
import {
  publishGiftCard,
  unpublishGiftCard,
  updateGiftCard,
  updateGiftCardPhoto,
} from "../actions";

type GiftCardData = {
  recipientName: string;
  recipientPhone: string;
  message: string | null;
  photo: string | null;
  status: "DRAFT" | "PUBLISHED";
  token: string | null;
  expiresAt: Date | null;
};

type Props = {
  orderId: string;
  clientName: string;
  items: { name: string; quantity: number }[];
  giftCard: GiftCardData;
};

export function GiftCardPanel({ orderId, clientName, items, giftCard }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState(giftCard);
  const [recipientName, setRecipientName] = useState(giftCard.recipientName);
  const [recipientPhone, setRecipientPhone] = useState(giftCard.recipientPhone);
  const [message, setMessage] = useState(giftCard.message ?? "");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [copied, setCopied] = useState(false);

  const defaultMessage = buildDefaultGiftMessage(clientName, items);
  const photoUrl = local.photo ? catalogPath(local.photo) : "/hero-illustration.png";
  const link = local.token ? giftCardUrl(local.token) : null;
  const isPublished = local.status === "PUBLISHED";

  function handleSave() {
    setError(null);
    const formData = new FormData();
    formData.set("recipientName", recipientName);
    formData.set("recipientPhone", recipientPhone);
    formData.set("message", message);

    startTransition(async () => {
      try {
        await updateGiftCard(orderId, formData);
        setLocal((prev) => ({ ...prev, recipientName, recipientPhone, message: message || null }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
      }
    });
  }

  async function handlePhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setIsUploadingPhoto(true);
    try {
      const fileName = await uploadProductImage(file);
      await updateGiftCardPhoto(orderId, fileName);
      setLocal((prev) => ({ ...prev, photo: fileName }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'envoi de la photo.");
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  function handlePublish() {
    setError(null);
    startTransition(async () => {
      try {
        const url = await publishGiftCard(orderId);
        const token = url.split("/cadeau/")[1];
        setLocal((prev) => ({
          ...prev,
          status: "PUBLISHED",
          token,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de la publication.");
      }
    });
  }

  function handleUnpublish() {
    setError(null);
    startTransition(async () => {
      try {
        await unpublishGiftCard(orderId);
        setLocal((prev) => ({ ...prev, status: "DRAFT" }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de la dépublication.");
      }
    });
  }

  async function handleCopyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponible — pas bloquant, le lien reste affiché et sélectionnable
    }
  }

  const whatsappMessage = `Bonjour ${local.recipientName} 🎁\n\n${clientName} vous a envoyé une carte cadeau !\n\nDécouvrez votre surprise ici : ${link ?? ""}\n\n_Glow by Imane 🌸_`;

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-medium">🎁 Carte cadeau</h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isPublished ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
          }`}
        >
          {isPublished ? "Publiée" : "Brouillon"}
        </span>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>
      )}

      <div className="space-y-3">
        <div className="flex gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl ?? "/hero-illustration.png"}
            alt="Photo de la carte cadeau"
            className="h-20 w-20 shrink-0 rounded-xl object-cover"
          />
          <label className="flex flex-1 flex-col justify-center gap-1">
            <span className="text-xs text-[var(--color-muted)]">
              {local.photo ? "Remplacer la photo" : "Aucune photo — illustration par défaut utilisée"}
            </span>
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              disabled={isUploadingPhoto}
              className="text-xs"
            />
            {isUploadingPhoto && <span className="text-xs text-[var(--color-muted)]">Envoi en cours...</span>}
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Nom du destinataire</span>
          <input
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Téléphone du destinataire</span>
          <input
            value={recipientPhone}
            onChange={(e) => setRecipientPhone(e.target.value)}
            className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium">Message sur la carte</span>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder={defaultMessage}
            className="w-full rounded-xl border border-[var(--color-border)] px-4 py-2.5 text-sm"
          />
          {!local.message && (
            <span className="text-xs text-[var(--color-muted)]">
              Aucun message saisi — le message générique ci-dessus sera affiché sur la carte.
            </span>
          )}
        </label>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isPending}
            className="rounded-full border border-[var(--color-accent)] px-4 py-2 text-sm font-medium text-[var(--color-accent)] disabled:opacity-50"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={isPending}
            className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPublished ? "Republier / prolonger" : "Publier"}
          </button>
          {isPublished && (
            <button
              type="button"
              onClick={handleUnpublish}
              disabled={isPending}
              className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 disabled:opacity-50"
            >
              Dépublier
            </button>
          )}
        </div>

        {isPublished && link && (
          <div className="space-y-2 border-t border-[var(--color-border)] pt-3">
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={link}
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-sand)] px-3 py-2 text-xs"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="shrink-0 rounded-full border border-[var(--color-border)] bg-white px-3 py-2 text-xs text-[var(--color-muted)] hover:text-[var(--color-accent)]"
              >
                {copied ? "✓ Copié" : "Copier"}
              </button>
            </div>
            {local.expiresAt && (
              <p className="text-xs text-[var(--color-muted)]">
                Expire le {new Date(local.expiresAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            )}
            <a
              href={buildWhatsAppUrl(local.recipientPhone, whatsappMessage)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-700 hover:bg-green-100"
            >
              <span>💬</span>
              Envoyer le lien au destinataire
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
