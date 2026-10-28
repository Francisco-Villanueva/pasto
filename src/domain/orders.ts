export const ORDER_STATUSES = [
  "PRELIMINAR",
  "PENDIENTE_CONFIRMACION",
  "CONFIRMADO",
  "EN_PRODUCCION",
  "LISTO",
  "ENTREGADO",
  "CANCELADO",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type StaffRole = "ADMIN" | "COCINA";

/** Camino normal de un pedido, de menor a mayor avance. */
const FLOW: readonly OrderStatus[] = [
  "PRELIMINAR",
  "PENDIENTE_CONFIRMACION",
  "CONFIRMADO",
  "EN_PRODUCCION",
  "LISTO",
  "ENTREGADO",
];

/** Vueltas atrás permitidas al admin: un paso por vez. */
const BACKWARD = new Set<string>([
  "CONFIRMADO>PENDIENTE_CONFIRMACION",
  "EN_PRODUCCION>CONFIRMADO",
  "LISTO>EN_PRODUCCION",
  "ENTREGADO>LISTO",
]);

/** Lo único que Cocina puede marcar. */
const KITCHEN = new Set<string>(["CONFIRMADO>EN_PRODUCCION", "EN_PRODUCCION>LISTO"]);

export type TransitionEffects = {
  /** El cambio exige completar `cancellation_reason`. */
  requiresCancellationReason: boolean;
  /** Al entregar: completar `delivered_at` y crear las tareas D+5 y D+12. */
  markDelivered: boolean;
  /** Al corregir una entrega: borrar `delivered_at` y las tareas CRM todavía PENDIENTE. */
  undoDelivery: boolean;
  /** Al reactivar un pedido cancelado: borrar el motivo de cancelación. */
  clearCancellationReason: boolean;
};

export type TransitionResult =
  | { allowed: true; effects: TransitionEffects }
  | { allowed: false; reason: "SAME_STATUS" | "FORBIDDEN_ROLE" | "INVALID_TRANSITION" };

function effectsFor(from: OrderStatus, to: OrderStatus): TransitionEffects {
  return {
    requiresCancellationReason: to === "CANCELADO",
    markDelivered: to === "ENTREGADO",
    undoDelivery: from === "ENTREGADO",
    clearCancellationReason: from === "CANCELADO",
  };
}

/**
 * Matriz de transiciones, validada siempre en el servidor.
 * - ADMIN: avanza (puede saltar estados hacia adelante), retrocede de a un paso,
 *   cancela hasta LISTO y reactiva un cancelado.
 * - COCINA: solo CONFIRMADO → EN_PRODUCCION y EN_PRODUCCION → LISTO.
 */
export function checkTransition(
  from: OrderStatus,
  to: OrderStatus,
  role: StaffRole,
): TransitionResult {
  if (from === to) return { allowed: false, reason: "SAME_STATUS" };

  const key = `${from}>${to}`;
  if (role === "COCINA") {
    return KITCHEN.has(key)
      ? { allowed: true, effects: effectsFor(from, to) }
      : { allowed: false, reason: "FORBIDDEN_ROLE" };
  }

  const fromIndex = FLOW.indexOf(from);
  const toIndex = FLOW.indexOf(to);

  let valid = false;
  if (to === "CANCELADO") valid = fromIndex >= 0 && from !== "ENTREGADO";
  else if (from === "CANCELADO") valid = to === "PRELIMINAR" || to === "PENDIENTE_CONFIRMACION";
  else if (toIndex > fromIndex) valid = true;
  else valid = BACKWARD.has(key);

  return valid
    ? { allowed: true, effects: effectsFor(from, to) }
    : { allowed: false, reason: "INVALID_TRANSITION" };
}

/** Estados a los que puede pasar un pedido según el rol (para armar los botones del admin). */
export function allowedTargets(from: OrderStatus, role: StaffRole): OrderStatus[] {
  return ORDER_STATUSES.filter((to) => checkTransition(from, to, role).allowed);
}

/** Solo estos pedidos entran en la hoja de producción. */
export function isCountedInProduction(status: OrderStatus): boolean {
  return status === "CONFIRMADO" || status === "EN_PRODUCCION";
}

/** PRELIMINAR y PENDIENTE_CONFIRMACION nunca cuentan como ingreso, ni los cancelados. */
export function isCountedInRevenue(status: OrderStatus): boolean {
  return (
    status === "CONFIRMADO" ||
    status === "EN_PRODUCCION" ||
    status === "LISTO" ||
    status === "ENTREGADO"
  );
}

/** El admin puede editar ítems, fecha y dirección hasta que se confirma. */
export function isEditableByAdmin(status: OrderStatus): boolean {
  return status === "PRELIMINAR" || status === "PENDIENTE_CONFIRMACION";
}

/**
 * ¿Se cancela por abandono? Solo los PRELIMINAR. `abandonAfterHours` nulo = regla desactivada.
 */
export function isAbandoned(
  order: { status: OrderStatus; createdAt: Date },
  now: Date,
  abandonAfterHours: number | null,
): boolean {
  if (abandonAfterHours === null || order.status !== "PRELIMINAR") return false;
  return now.getTime() - order.createdAt.getTime() >= abandonAfterHours * 3_600_000;
}

export const DEFAULT_ABANDON_AFTER_HOURS = 48;

/**
 * Lee el ajuste `abandon_after_hours`: falta o es inválido → 48 h; 0 → regla desactivada (null);
 * un número positivo → ese plazo.
 */
export function abandonAfterHoursFromSetting(value: unknown): number | null {
  if (value === undefined || value === null) return DEFAULT_ABANDON_AFTER_HOURS;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return DEFAULT_ABANDON_AFTER_HOURS;
  }
  return value === 0 ? null : value;
}
