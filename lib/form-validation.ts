// Destination : lib/form-validation.ts
// Conversion + validation des nombres et dates reçus par les server actions admin.
// `Number("abc")` donne NaN et `Number("")` donne 0 : sans contrôle, Prisma
// plantait avec une erreur illisible ou enregistrait des valeurs absurdes
// (prix négatif, stock décimal…).

import { UserError } from "@/lib/action-result";

type IntOptions = { min?: number; max?: number; optional?: boolean };

/** Plafond par défaut : 1 milliard GNF / unités, largement au-delà de tout usage réel. */
const DEFAULT_MAX = 1_000_000_000;

/**
 * Convertit une valeur (FormData, JSON, nombre) en entier borné.
 * Accepte "15 000" ou "15000" (espaces retirés). Lève une UserError sinon.
 */
export function toInt(value: unknown, label: string, options: IntOptions = {}): number {
  const { min = 0, max = DEFAULT_MAX, optional = false } = options;

  const raw = typeof value === "string" ? value.replace(/\s/g, "") : value;
  if (raw === undefined || raw === null || raw === "") {
    // Valeur vide et optionnelle : 0, ramené dans les bornes (ex: min 1 → 1 ; min négatif → 0)
    if (optional) return Math.min(Math.max(0, min), max);
    throw new UserError(`${label} requis.`);
  }

  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n)) throw new UserError(`${label} doit être un nombre entier.`);
  if (n < min) throw new UserError(`${label} doit être supérieur ou égal à ${min}.`);
  if (n > max) throw new UserError(`${label} doit être inférieur ou égal à ${max}.`);
  return n;
}

/** Convertit une chaîne en Date valide. Lève une UserError si la date est invalide. */
export function toDate(value: unknown, label: string): Date {
  const date = typeof value === "string" || value instanceof Date ? new Date(value) : new Date(NaN);
  if (Number.isNaN(date.getTime())) throw new UserError(`${label} invalide.`);
  return date;
}

/** Parse un champ JSON de formulaire et vérifie qu'il s'agit d'un tableau. */
export function toJsonArray(raw: FormDataEntryValue | null, label: string): unknown[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(raw));
  } catch {
    throw new UserError(`${label} : données invalides.`);
  }
  if (!Array.isArray(parsed)) throw new UserError(`${label} : données invalides.`);
  return parsed;
}
