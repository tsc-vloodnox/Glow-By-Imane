// Destination : app/admin/clientes/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { UserError, withActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "../actions";

async function updateCustomerImpl(customerId: string, formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const businessName = String(formData.get("businessName") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const isReseller = formData.get("isReseller") === "on";

  if (!name) throw new UserError("Le nom est requis.");
  if (name.length > 80 || (businessName?.length ?? 0) > 120 || (notes?.length ?? 0) > 2000) {
    throw new UserError("Texte trop long.");
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: { name, businessName, notes, isReseller },
  });

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${customerId}`);
}

// ─── Exports ──────────────────────────────────────────────────────────────────
// Enveloppées par withActionResult : renvoient { ok, data | error } (cf. lib/action-result.ts)

export const updateCustomer = withActionResult(updateCustomerImpl);
