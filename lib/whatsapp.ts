import type { OrderWithItems } from "@/types/types";

type CustomerDetails = {
  name: string;
  phone: string;
  quartier: string;
  comment?: string;
};

export function buildOrderMessage(order: OrderWithItems, customer: CustomerDetails): string {
  const lines = order.items.map(
    (item) => `- ${item.product.name} x${item.quantity}`,
  );

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
  return `https://wa.me/${vendorNumber}?text=${encodeURIComponent(message)}`;
}
