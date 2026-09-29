// Destination : app/admin/_components/push-actions.ts
"use server";

import { UserError, withActionResult } from "@/lib/action-result";
import { notifyAdmins } from "@/lib/push";
import { requireAdmin } from "../actions";

/** Envoie une notification de test à tous les appareils abonnés. */
async function sendTestNotificationImpl() {
  await requireAdmin();
  const { sent } = await notifyAdmins({
    title: "Notifications activées ✓",
    body: "Vous serez prévenue à chaque nouvelle commande.",
    url: "/admin/commandes",
    tag: "test",
  });
  if (sent === 0) {
    throw new UserError("Aucun appareil n'a reçu la notification. Vérifiez les clés VAPID et réactivez les notifications.");
  }
  return sent;
}

export const sendTestNotification = withActionResult(sendTestNotificationImpl);
