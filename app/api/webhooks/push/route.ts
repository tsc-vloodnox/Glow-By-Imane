import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { ADMIN_COOKIE_NAME, isSignedTokenValid } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// Abonnement Web Push des appareils admin (notifications "nouvelle commande").
// Réservé à l'admin connecté : sinon n'importe qui pourrait s'abonner et
// recevoir le flux des commandes, ou désabonner les appareils de l'admin.

type PushSubscriptionBody = { endpoint: string; keys: { p256dh: string; auth: string } };

async function isAdmin() {
  const cookieStore = await cookies();
  return isSignedTokenValid(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
}

function isValidEndpoint(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 1000) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isShortString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return typeof body === "object" && body !== null ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function parseSubscription(body: Record<string, unknown> | null): PushSubscriptionBody | null {
  const keys = body?.keys as Record<string, unknown> | undefined;
  if (!body || !isValidEndpoint(body.endpoint) || !keys) return null;
  if (!isShortString(keys.p256dh) || !isShortString(keys.auth)) return null;
  return { endpoint: body.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const subscription = parseSubscription(await readJson(request));
  if (!subscription) {
    return NextResponse.json({ error: "Abonnement invalide." }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    create: {
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    update: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const body = await readJson(request);
  if (!body || !isValidEndpoint(body.endpoint)) {
    return NextResponse.json({ error: "Abonnement invalide." }, { status: 400 });
  }

  await prisma.pushSubscription.deleteMany({
    where: { endpoint: body.endpoint },
  });

  return NextResponse.json({ ok: true });
}
