import type { Cents } from "./money";

/** Reglas de lo que el admin puede cargar en la agenda. Las usan el formulario y el servidor. */

export const MAX_SLOTS_PER_DAY = 8;
export const MAX_SLOT_LENGTH = 40;
export const MAX_SHIPPING_TIERS = 12;
export const MAX_ABANDON_HOURS = 24 * 30;

export type AgendaIssue =
  | "SLOTS_EMPTY_NAME"
  | "SLOTS_TOO_LONG"
  | "SLOTS_DUPLICATED"
  | "SLOTS_TOO_MANY"
  | "TIERS_EMPTY"
  | "TIERS_TOO_MANY"
  | "TIER_DISTANCE_INVALID"
  | "TIER_DISTANCE_DUPLICATED"
  | "TIER_FEE_INVALID"
  | "MAX_DISTANCE_INVALID"
  | "MAX_DISTANCE_BELOW_TIERS"
  | "ABANDON_INVALID";

export const AGENDA_ISSUE_MESSAGE: Record<AgendaIssue, string> = {
  SLOTS_EMPTY_NAME: "Escribí el horario de cada franja.",
  SLOTS_TOO_LONG: `Cada franja puede tener hasta ${MAX_SLOT_LENGTH} caracteres.`,
  SLOTS_DUPLICATED: "Hay franjas repetidas.",
  SLOTS_TOO_MANY: `Podés cargar hasta ${MAX_SLOTS_PER_DAY} franjas por día.`,
  TIERS_EMPTY: "Cargá al menos un tramo de envío.",
  TIERS_TOO_MANY: `Podés cargar hasta ${MAX_SHIPPING_TIERS} tramos.`,
  TIER_DISTANCE_INVALID: "La distancia de cada tramo tiene que ser un número de metros mayor a 0.",
  TIER_DISTANCE_DUPLICATED: "Hay dos tramos con la misma distancia.",
  TIER_FEE_INVALID: "El costo de cada tramo tiene que ser 0 o más.",
  MAX_DISTANCE_INVALID: "El radio máximo tiene que ser un número de metros mayor a 0.",
  MAX_DISTANCE_BELOW_TIERS:
    "El radio máximo no puede ser menor que el último tramo: ese tramo nunca se usaría.",
  ABANDON_INVALID: `El plazo tiene que ser 0 (desactivado) o un número entero de horas hasta ${MAX_ABANDON_HOURS}.`,
};

/** Limpia espacios y devuelve las franjas válidas o el problema encontrado. */
export function validateSlots(
  slots: readonly string[],
): { ok: true; slots: string[] } | { ok: false; issue: AgendaIssue } {
  const clean = slots.map((s) => s.trim().replace(/\s+/g, " "));
  if (clean.length > MAX_SLOTS_PER_DAY) return { ok: false, issue: "SLOTS_TOO_MANY" };
  if (clean.some((s) => s === "")) return { ok: false, issue: "SLOTS_EMPTY_NAME" };
  if (clean.some((s) => s.length > MAX_SLOT_LENGTH)) return { ok: false, issue: "SLOTS_TOO_LONG" };
  if (new Set(clean.map((s) => s.toLowerCase())).size !== clean.length) {
    return { ok: false, issue: "SLOTS_DUPLICATED" };
  }
  return { ok: true, slots: clean };
}

export type TierInput = { upToM: number; feeCents: Cents };

/** Valida la tabla de tramos y el radio máximo. Devuelve los tramos ordenados por distancia. */
export function validateShipping(
  tiers: readonly TierInput[],
  maxDistanceM: number,
): { ok: true; tiers: TierInput[] } | { ok: false; issue: AgendaIssue } {
  if (tiers.length === 0) return { ok: false, issue: "TIERS_EMPTY" };
  if (tiers.length > MAX_SHIPPING_TIERS) return { ok: false, issue: "TIERS_TOO_MANY" };
  if (tiers.some((t) => !Number.isInteger(t.upToM) || t.upToM <= 0)) {
    return { ok: false, issue: "TIER_DISTANCE_INVALID" };
  }
  if (tiers.some((t) => !Number.isInteger(t.feeCents) || t.feeCents < 0)) {
    return { ok: false, issue: "TIER_FEE_INVALID" };
  }
  if (new Set(tiers.map((t) => t.upToM)).size !== tiers.length) {
    return { ok: false, issue: "TIER_DISTANCE_DUPLICATED" };
  }
  if (!Number.isInteger(maxDistanceM) || maxDistanceM <= 0) {
    return { ok: false, issue: "MAX_DISTANCE_INVALID" };
  }
  const sorted = [...tiers].sort((a, b) => a.upToM - b.upToM);
  if (sorted[sorted.length - 1]!.upToM > maxDistanceM) {
    return { ok: false, issue: "MAX_DISTANCE_BELOW_TIERS" };
  }
  return { ok: true, tiers: sorted };
}

/** Plazo de abandono en horas: 0 desactiva la cancelación automática. */
export function validateAbandonHours(hours: number): boolean {
  return Number.isInteger(hours) && hours >= 0 && hours <= MAX_ABANDON_HOURS;
}
