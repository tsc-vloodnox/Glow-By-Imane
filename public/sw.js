// Service worker Glow by Imane — notifications de l'admin (nouvelles commandes).
// Enregistré uniquement depuis l'admin, quand l'administratrice active les notifications.

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Glow by Imane", {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag,
      data: { url: data.url || "/admin/commandes" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Uniquement des liens internes au site
  const target = new URL(event.notification.data?.url || "/admin/commandes", self.location.origin);
  const url = target.origin === self.location.origin ? target.href : `${self.location.origin}/admin/commandes`;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((w) => w.url.startsWith(self.location.origin));
      if (existing) {
        return existing.navigate(url).then((w) => (w || existing).focus());
      }
      return self.clients.openWindow(url);
    }),
  );
});
