// Destination : lib/action-result.ts
//
// Pourquoi ce module : en production, Next.js MASQUE le message des erreurs
// levées dans une server action (le client reçoit un message générique). Les
// messages métier ("Stock insuffisant…", "Ce produit a des commandes…") ne
// parvenaient donc jamais à l'utilisateur.
//
// Solution : les actions ne lèvent plus d'erreur vers le client, elles
// renvoient { ok: true, data } ou { ok: false, error }.
// - Côté serveur : on enveloppe l'action avec `withActionResult` et on lève
//   `UserError` pour tout message destiné à l'utilisateur.
// - Côté client : `unwrap(await action(...))` relève une Error classique avec
//   le bon message, ce qui garde les try/catch existants inchangés.

import { unstable_rethrow } from "next/navigation";

/** Erreur dont le message peut être montré tel quel à l'utilisateur. */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const GENERIC_ERROR = "Une erreur est survenue. Merci de réessayer.";

/** Codes Prisma courants traduits en message compréhensible. */
const PRISMA_MESSAGES: Record<string, string> = {
  P2002: "Cette valeur existe déjà (doublon).",
  P2003: "Opération impossible : cet élément est encore utilisé ailleurs.",
  P2025: "Élément introuvable (il a peut-être déjà été supprimé).",
};

function toUserMessage(error: unknown): string {
  if (error instanceof UserError) return error.message;

  const code =
    typeof error === "object" && error && "code" in error ? (error as { code?: unknown }).code : undefined;
  if (typeof code === "string" && PRISMA_MESSAGES[code]) return PRISMA_MESSAGES[code];

  console.error("[action] Erreur inattendue :", error);
  return GENERIC_ERROR;
}

/**
 * Enveloppe une server action pour qu'elle renvoie un ActionResult au lieu de
 * lever une erreur. Les redirect()/notFound() de Next sont laissés passer.
 */
export function withActionResult<Args extends unknown[], T>(
  action: (...args: Args) => Promise<T>,
): (...args: Args) => Promise<ActionResult<T>> {
  return async (...args: Args) => {
    try {
      return { ok: true, data: await action(...args) };
    } catch (error) {
      unstable_rethrow(error);
      return { ok: false, error: toUserMessage(error) };
    }
  };
}

/** Côté client : renvoie la donnée, ou lève une Error portant le message utilisateur. */
export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

/**
 * Côté client : transforme une action "ActionResult" en fonction qui renvoie la
 * donnée ou lève une Error au message utilisateur. Permet de garder les appels
 * et try/catch existants : `const createX = unwrapAction(createXAction);`
 */
export function unwrapAction<Args extends unknown[], T>(
  action: (...args: Args) => Promise<ActionResult<T>>,
): (...args: Args) => Promise<T> {
  return async (...args: Args) => unwrap(await action(...args));
}
