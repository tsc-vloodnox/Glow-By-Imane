self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {
    title: "Glow by Imane",
    body: "Nouvelle notification",
    url: "/admin/commandes",
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      data: { url: data.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/admin/commandes";
  event.waitUntil(clients.openWindow(url));
});
