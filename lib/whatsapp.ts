import type { OrderWithItems } from "@/types/types";

type CustomerDetails = { name: string; phone: string; quartier: string; comment?: string };

/**
 * Normalise un numéro guinéen vers le format attendu par wa.me (224XXXXXXXXX),
 * quelle que soit la façon dont il a été saisi (avec ou sans "+224"/"224"
 * en préfixe, ou avec un "0" initial). Sans ça, un numéro déjà préfixé
 * par l'indicatif se retrouve doublé (ex: 224224XXXXXXXX) et le lien WhatsApp
 * généré ne correspond plus au bon contact.
 */
export function normalizeGuineaPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const withoutCountryCode = digits.startsWith("224") ? digits.slice(3) : digits;
  const local = withoutCountryCode.replace(/^0+/, "");
  return `224${local}`;
}

/** Construit une URL wa.me à partir d'un numéro guinéen brut et d'un message optionnel (non encodé). */
export function buildWhatsAppUrl(phone: string, message?: string): string {
  const base = `https://wa.me/${normalizeGuineaPhone(phone)}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function buildOrderMessage(
  order: OrderWithItems,
  customer: CustomerDetails,
  giftPrintFee?: number,
): string {
  const lines = order.items.map((item) => {
    if (item.kit) return `- ${item.kit.name} (kit) x${item.quantity}`;
    const sizePart = item.productSize ? ` (${item.productSize.label})` : "";
    return `- ${item.product?.name ?? "Article"}${sizePart} x${item.quantity}`;
  });

  if (giftPrintFee) {
    lines.push(`- Impression de la carte cadeau : ${giftPrintFee.toLocaleString("fr-GN")} GNF`);
  }

  const customerInfo = [
    `Nom : ${customer.name}`,
    `Téléphone : ${customer.phone}`,
    `Quartier : ${customer.quartier}`,
    customer.comment ? `Commentaire : ${customer.comment}` : null,
  ].filter(Boolean);

  const message = `Bonjour,

Je souhaite commander :

Commande #${order.number}

${lines.join("\n")}

Montant estimé : ${order.estimatedTotal.toLocaleString("fr-GN")} GNF

Informations client :
${customerInfo.join("\n")}

Pouvez-vous confirmer la disponibilité et les frais de livraison ?`;

  const vendorNumber = process.env.WHATSAPP_VENDOR_NUMBER ?? "";
  return buildWhatsAppUrl(vendorNumber, message);
}