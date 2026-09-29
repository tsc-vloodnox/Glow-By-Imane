// Destination : lib/push.ts
// Notifications Web Push vers les appareils de l'admin (nouvelle commande, demande revendeur).
// Serveur uniquement. Un échec d'envoi ne doit JAMAIS faire échouer une commande.

import webpush from "web-push";

import { prisma } from "@/lib/prisma";

export type PushPayload = { title: string; body: string; url: string; tag?: string };

let configured: boolean | undefined;

/** Configure web-push au premier envoi ; false si les clés VAPID sont absentes. */
function ensureConfigured(): boolean {
  if (configured !== undefined) return configured;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn("[push] Clés VAPID absentes : notifications désactivées.");
    configured = false;
    return false;
  }

  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? "mailto:admin@glowbyimane.com", publicKey, privateKey);
  configured = true;
  return true;
}

/** Réinitialise la configuration (tests). */
export function resetPushConfiguration() {
  configured = undefined;
}

function statusCodeOf(error: unknown): number | undefined {
  return typeof error === "object" && error && "statusCode" in error
    ? Number((error as { statusCode: unknown }).statusCode)
    : undefined;
}

/**
 * Envoie une notification à tous les appareils abonnés.
 * Les abonnements expirés (404/410 : appareil désabonné, navigateur réinstallé…) sont supprimés.
 */
export async function notifyAdmins(payload: PushPayload): Promise<{ sent: number; removed: number }> {
  try {
    if (!ensureConfigured()) return { sent: 0, removed: 0 };

    const subscriptions = await prisma.pushSubscription.findMany();
    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 24 }, // conservée 24 h si le téléphone est éteint
        ),
      ),
    );

    const expired = subscriptions.filter((_, i) => {
      const result = results[i];
      return result.status === "rejected" && [404, 410].includes(statusCodeOf(result.reason) ?? 0);
    });
    if (expired.length > 0) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: expired.map((s) => s.endpoint) } } });
    }

    results.forEach((result, i) => {
      if (result.status === "rejected" && !expired.includes(subscriptions[i])) {
        console.error("[push] Échec d'envoi :", result.reason);
      }
    });

    return { sent: results.filter((r) => r.status === "fulfilled").length, removed: expired.length };
  } catch (error) {
    console.error("[push] Erreur inattendue :", error);
    return { sent: 0, removed: 0 };
  }
}

/** Notification « nouvelle commande » / « nouvelle demande revendeur ». */
export function notifyNewOrder(order: { id: string; number: number; name: string; finalTotal: number; kind: "DETAIL" | "GROS" }) {
  const wholesale = order.kind === "GROS";
  return notifyAdmins({
    title: wholesale ? "Nouvelle demande revendeur" : "Nouvelle commande",
    body: `#${order.number} · ${order.name} · ${order.finalTotal.toLocaleString("fr-GN")} GNF${wholesale ? " (indicatif)" : ""}`,
    url: `/admin/commandes/${order.id}`,
    tag: `order-${order.id}`,
  });
}
