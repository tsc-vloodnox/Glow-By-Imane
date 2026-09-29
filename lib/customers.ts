// Destination : lib/customers.ts
// Fiches clientes : rattachement automatique des commandes par numéro de téléphone.

import type { Prisma } from "@prisma/client";

import { normalizeGuineaPhone } from "@/lib/whatsapp";

type CustomerInput = {
  phone: string;
  name: string;
  quartier: string;
  businessName?: string | null;
  isReseller?: boolean;
};

/**
 * Crée ou met à jour la fiche cliente correspondant au numéro, et renvoie son id.
 * - Nom et quartier : les plus récents l'emportent (la cliente a pu déménager).
 * - Statut revendeur : une fois revendeur, toujours revendeur (jamais rétrogradé
 *   automatiquement par une commande au détail) ; modifiable à la main dans l'admin.
 */
export async function upsertCustomer(tx: Prisma.TransactionClient, input: CustomerInput): Promise<string> {
  const phone = normalizeGuineaPhone(input.phone);
  const businessName = input.businessName?.trim() || undefined;

  const customer = await tx.customer.upsert({
    where: { phone },
    create: {
      phone,
      name: input.name,
      quartier: input.quartier,
      businessName: businessName ?? null,
      isReseller: input.isReseller ?? false,
    },
    update: {
      name: input.name,
      quartier: input.quartier,
      ...(businessName ? { businessName } : {}),
      ...(input.isReseller ? { isReseller: true } : {}),
    },
    select: { id: true },
  });

  return customer.id;
}
