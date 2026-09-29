import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendNotification, setVapidDetails, findMany, deleteMany } = vi.hoisted(() => ({
  sendNotification: vi.fn(),
  setVapidDetails: vi.fn(),
  findMany: vi.fn(),
  deleteMany: vi.fn(),
}));

vi.mock("web-push", () => ({ default: { sendNotification, setVapidDetails } }));
vi.mock("@/lib/prisma", () => ({ prisma: { pushSubscription: { findMany, deleteMany } } }));

import { notifyAdmins, notifyNewOrder, resetPushConfiguration } from "./push";

const sub = (endpoint: string) => ({ endpoint, p256dh: "k", auth: "a" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  resetPushConfiguration();
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "pub");
  vi.stubEnv("VAPID_PRIVATE_KEY", "priv");
});

describe("notifyAdmins", () => {
  it("envoie à tous les appareils et supprime les abonnements expirés (404/410)", async () => {
    findMany.mockResolvedValue([sub("https://a"), sub("https://b"), sub("https://c")]);
    sendNotification
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(Object.assign(new Error("Gone"), { statusCode: 410 }))
      .mockRejectedValueOnce(Object.assign(new Error("Server"), { statusCode: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await notifyAdmins({ title: "t", body: "b", url: "/admin" });

    expect(result).toEqual({ sent: 1, removed: 1 });
    // Une erreur temporaire (500) ne supprime pas l'abonnement
    expect(deleteMany).toHaveBeenCalledWith({ where: { endpoint: { in: ["https://b"] } } });
  });

  it("sans clés VAPID : aucun envoi, aucune erreur", async () => {
    vi.stubEnv("VAPID_PRIVATE_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(await notifyAdmins({ title: "t", body: "b", url: "/" })).toEqual({ sent: 0, removed: 0 });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("une panne (base injoignable) ne lève jamais d'erreur", async () => {
    findMany.mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(notifyAdmins({ title: "t", body: "b", url: "/" })).resolves.toEqual({ sent: 0, removed: 0 });
  });
});

describe("notifyNewOrder", () => {
  it("distingue commande au détail et demande revendeur, lien vers la commande", async () => {
    findMany.mockResolvedValue([sub("https://a")]);
    sendNotification.mockResolvedValue({});

    await notifyNewOrder({ id: "o1", number: 42, name: "Awa", finalTotal: 150000, kind: "GROS" });

    const payload = JSON.parse(sendNotification.mock.calls[0][1]);
    expect(payload.title).toBe("Nouvelle demande revendeur");
    expect(payload.url).toBe("/admin/commandes/o1");
    expect(payload.body).toContain("#42");
  });
});
