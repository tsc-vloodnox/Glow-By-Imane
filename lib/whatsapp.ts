import { formatFeeRange, mapsUrl } from "@/lib/delivery";
import type { OrderWithItems } from "@/types/types";

type DeliveryDetails = {
  mode: "LIVRAISON" | "RETRAIT";
  feeMin: number | null;
  feeMax: number | null;
  location: { lat: number; lng: number } | null;
};

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
  delivery?: DeliveryDetails,
): string {
  const lines = order.items.map((item) => {
    if (item.kit) return `- ${item.kit.name} (kit) x${item.quantity}`;
    const sizePart = item.productSize ? ` (${item.productSize.label})` : "";
    return `- ${item.product?.name ?? "Article"}${sizePart} x${item.quantity}`;
  });

  if (giftPrintFee) {
    lines.push(`- Impression de la carte cadeau : ${giftPrintFee.toLocaleString("fr-GN")} GNF`);
  }

  const isPickup = delivery?.mode === "RETRAIT";
  const feeRange = delivery ? formatFeeRange(delivery.feeMin, delivery.feeMax) : null;
  const customerInfo = [
    `Nom : ${customer.name}`,
    `Téléphone : ${customer.phone}`,
    isPickup ? `Mode : ${customer.quartier}` : `Quartier : ${customer.quartier}`,
    !isPickup && delivery ? `Frais de livraison estimés : ${feeRange ?? "à confirmer"}` : null,
    !isPickup && delivery?.location ? `Ma position : ${mapsUrl(delivery.location)}` : null,
    customer.comment ? `Commentaire : ${customer.comment}` : null,
  ].filter(Boolean);

  const message = `Bonjour,

Je souhaite commander :

Commande #${order.number}

${lines.join("\n")}

Montant estimé : ${order.estimatedTotal.toLocaleString("fr-GN")} GNF

Informations client :
${customerInfo.join("\n")}

${isPickup ? "Pouvez-vous me dire quand la commande sera prête à récupérer ?" : "Pouvez-vous confirmer la disponibilité et les frais de livraison ?"}`;

  const vendorNumber = process.env.WHATSAPP_VENDOR_NUMBER ?? "";
  return buildWhatsAppUrl(vendorNumber, message);
}
type WholesaleMessageInput = {
  number: number;
  estimatedTotal: number;
  lines: { label: string; quantity: number; unitPrice: number; requestedUnitPrice?: number | null }[];
  name: string;
  phone: string;
  quartier: string;
  businessName?: string | null;
  comment?: string | null;
};

/** Message WhatsApp d'une demande revendeur (prix indicatif, à confirmer ensemble). */
export function buildWholesaleMessage(request: WholesaleMessageInput): string {
  const gnf = (value: number) => value.toLocaleString("fr-GN");
  const lines = request.lines.map((line) =>
    line.requestedUnitPrice
      ? `- ${line.label} x${line.quantity} — souhaité : ${gnf(line.requestedUnitPrice)} GNF/u (indicatif ${gnf(line.unitPrice)})`
      : `- ${line.label} x${line.quantity}`,
  );
  const hasRequested = request.lines.some((line) => line.requestedUnitPrice);
  // Total « souhaité » : prix proposé quand il existe, prix indicatif sinon
  const requestedTotal = request.lines.reduce(
    (sum, line) => sum + (line.requestedUnitPrice ?? line.unitPrice) * line.quantity,
    0,
  );
  const info = [
    `Nom : ${request.name}`,
    request.businessName ? `Boutique : ${request.businessName}` : null,
    `Téléphone : ${request.phone}`,
    `Ville / quartier : ${request.quartier}`,
    request.comment ? `Commentaire : ${request.comment}` : null,
  ].filter(Boolean);

  const message = `Bonjour,

Je suis revendeur et je souhaite commander en gros :

Demande revendeur #${request.number}

${lines.join("\n")}

Total indicatif : ${gnf(request.estimatedTotal)} GNF${hasRequested ? `
Total selon mes prix souhaités : ${gnf(requestedTotal)} GNF` : ""} (à confirmer ensemble)

Mes informations :
${info.join("\n")}

Pouvez-vous me confirmer vos prix, la disponibilité et les délais ?`;

  return buildWhatsAppUrl(process.env.WHATSAPP_VENDOR_NUMBER ?? "", message);
}
