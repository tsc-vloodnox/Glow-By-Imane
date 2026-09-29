"use client";

import { useEffect, useState } from "react";

import { unwrapAction } from "@/lib/action-result";
import { sendTestNotification as sendTestNotificationAction } from "./push-actions";

// Action serveur : lève une Error au message lisible en cas d'échec (cf. lib/action-result.ts)
const sendTestNotification = unwrapAction(sendTestNotificationAction);

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

type State = "loading" | "unsupported" | "ios-install" | "no-key" | "denied" | "off" | "on";

/** Clé VAPID (base64url) → Uint8Array attendu par pushManager.subscribe */
function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function detectState(): State | null {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    // Sur iPhone, le Web Push n'existe que pour un site ajouté à l'écran d'accueil
    return isIOS && !standalone ? "ios-install" : "unsupported";
  }
  if (!VAPID_PUBLIC_KEY) return "no-key";
  if (Notification.permission === "denied") return "denied";
  return null;
}

async function saveSubscription(method: "POST" | "DELETE", body: unknown) {
  const response = await fetch("/api/webhooks/push", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("L'enregistrement de l'appareil a échoué. Reconnectez-vous puis réessayez.");
}

export function PushNotificationsToggle() {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const blocked = detectState();
    if (blocked) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(blocked);
      return;
    }
    navigator.serviceWorker
      .getRegistration("/sw.js")
      .then((registration) => registration?.pushManager.getSubscription())
      .then((subscription) => setState(subscription ? "on" : "off"))
      .catch(() => setState("off"));
  }, []);

  async function enable() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
        }));
      await saveSubscription("POST", subscription.toJSON());
      setState("on");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Activation impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage(null);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await saveSubscription("DELETE", { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setState("off");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Désactivation impossible.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMessage(null);
    try {
      const sent = await sendTestNotification();
      setMessage(`Notification de test envoyée à ${sent} appareil${sent > 1 ? "s" : ""}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Envoi impossible.");
    } finally {
      setBusy(false);
    }
  }

  const hint: Partial<Record<State, string>> = {
    unsupported: "Ce navigateur ne prend pas en charge les notifications.",
    "ios-install": "Sur iPhone : ajoutez d'abord le site à l'écran d'accueil (Partager → Sur l'écran d'accueil), puis ouvrez-le depuis l'icône.",
    "no-key": "Clés VAPID non configurées (NEXT_PUBLIC_VAPID_PUBLIC_KEY et VAPID_PRIVATE_KEY).",
    denied: "Notifications bloquées pour ce site : autorisez-les dans les réglages du navigateur.",
  };

  return (
    <section className="rounded-xl border border-[var(--color-border)] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-medium">Notifications de commandes</h2>
          <p className="text-sm text-[var(--color-muted)]">
            {state === "on"
              ? "Activées sur cet appareil : vous êtes prévenue à chaque commande."
              : hint[state] ?? "Recevez une alerte sur cet appareil à chaque nouvelle commande."}
          </p>
        </div>
        {state === "off" && (
          <button type="button" onClick={enable} disabled={busy}
            className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            {busy ? "…" : "Activer"}
          </button>
        )}
        {state === "on" && (
          <div className="flex gap-2">
            <button type="button" onClick={test} disabled={busy}
              className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm disabled:opacity-60">
              Tester
            </button>
            <button type="button" onClick={disable} disabled={busy}
              className="rounded-full border border-[var(--color-border)] px-4 py-2 text-sm text-[var(--color-muted)] disabled:opacity-60">
              Désactiver
            </button>
          </div>
        )}
      </div>
      {message ? <p className="mt-2 text-sm text-[var(--color-muted)]">{message}</p> : null}
    </section>
  );
}
