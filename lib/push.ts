import webpush from "web-push";

import { prisma } from "@/lib/prisma";

webpush.setVapidDetails(
  "mailto:admin@glowbyimane.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

export async function sendOrderNotification(orderNumber: number) {
  const subscriptions = await prisma.pushSubscription.findMany();

  const payload = JSON.stringify({
    title: "Nouvelle commande",
    body: `Commande #${orderNumber} reçue`,
    url: "/admin/commandes",
  });

  await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
      ),
    ),
  );
}
