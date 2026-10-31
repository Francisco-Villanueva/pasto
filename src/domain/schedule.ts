import { DateTime } from "luxon";

export const TIME_ZONE = "America/Argentina/Buenos_Aires";

export type DeliveryWeekday = "MIERCOLES" | "VIERNES";

/** Un día de entrega concreto, tal como se guarda en la agenda (`DeliveryDay`). */
export type DeliveryDayConfig = {
  /** Fecha local, `YYYY-MM-DD`. */
  date: string;
  isOpen: boolean;
  /** Instante en que cierran los pedidos para este día. */
  cutoffAt: Date;
  slots: readonly string[];
};

const WEEKDAY_BY_LUXON: Record<number, DeliveryWeekday | undefined> = {
  3: "MIERCOLES",
  5: "VIERNES",
};

function parseDate(date: string): DateTime {
  const parsed = DateTime.fromISO(date, { zone: TIME_ZONE });
  if (!parsed.isValid) throw new Error(`Fecha inválida: ${date}`);
  return parsed.startOf("day");
}

export function weekdayOf(date: string): DeliveryWeekday | null {
  return WEEKDAY_BY_LUXON[parseDate(date).weekday] ?? null;
}

/**
 * Corte por defecto, en hora de Buenos Aires:
 * - miércoles: lunes a las 12:00
 * - viernes: miércoles a las 12:00
 * En ambos casos son dos días antes de la entrega.
 */
export function defaultCutoff(date: string): Date {
  if (weekdayOf(date) === null) {
    throw new Error(`Solo hay entregas los miércoles y viernes: ${date}`);
  }
  return parseDate(date).minus({ days: 2 }).set({ hour: 12 }).toJSDate();
}

export type GenerateOptions = {
  /** Cuántas semanas hacia adelante (incluye la actual). */
  weeks: number;
  /** Viernes que el admin abrió, `YYYY-MM-DD`. El resto queda cerrado. */
  openFridays?: ReadonlySet<string>;
  defaultSlots: readonly string[];
};

/**
 * Propone los miércoles (abiertos) y viernes (cerrados salvo que se abran) de las próximas semanas.
 * Solo es el borrador: el admin puede abrir, cerrar o mover el corte de cada fecha.
 */
export function generateDeliveryDays(now: Date, options: GenerateOptions): DeliveryDayConfig[] {
  const today = DateTime.fromJSDate(now, { zone: TIME_ZONE }).startOf("day");
  const days: DeliveryDayConfig[] = [];

  for (let offset = 0; offset < options.weeks * 7; offset++) {
    const day = today.plus({ days: offset });
    const weekday = WEEKDAY_BY_LUXON[day.weekday];
    if (!weekday) continue;
    const date = day.toISODate()!;
    days.push({
      date,
      isOpen: weekday === "MIERCOLES" || (options.openFridays?.has(date) ?? false),
      cutoffAt: defaultCutoff(date),
      slots: options.defaultSlots,
    });
  }
  return days;
}

/** El corte es estricto: a las 12:00 en punto ya está cerrado. */
export function isDayAvailable(day: DeliveryDayConfig, now: Date): boolean {
  return day.isOpen && now.getTime() < day.cutoffAt.getTime();
}

/** Días que se pueden elegir en el checkout. El servidor vuelve a llamar a esto al crear el pedido. */
export function getAvailableDeliveryDays(
  now: Date,
  days: readonly DeliveryDayConfig[],
): DeliveryDayConfig[] {
  return days
    .filter((day) => isDayAvailable(day, now))
    .sort((a, b) => a.date.localeCompare(b.date));
}

const DAY_NAMES: Record<DeliveryWeekday, string> = { MIERCOLES: "Miércoles", VIERNES: "Viernes" };

/** "Miércoles 04/11" para mostrar al cliente. */
export function formatDeliveryDay(date: string): string {
  const weekday = weekdayOf(date);
  if (!weekday) throw new Error(`Solo hay entregas los miércoles y viernes: ${date}`);
  return `${DAY_NAMES[weekday]} ${parseDate(date).toFormat("dd/LL")}`;
}

/** Suma días a una fecha local sin pasar por la hora (para D+5 y D+12). */
export function addDays(date: string, days: number): string {
  return parseDate(date).plus({ days }).toISODate()!;
}

/** Fecha local (Buenos Aires) de un instante. */
export function localDate(instant: Date): string {
  return DateTime.fromJSDate(instant, { zone: TIME_ZONE }).toISODate()!;
}

/** "lunes a las 12:00": cuándo cierran los pedidos de un día, en hora de Buenos Aires. */
export function formatCutoff(cutoffAt: Date): string {
  return DateTime.fromJSDate(cutoffAt, { zone: TIME_ZONE })
    .setLocale("es-AR")
    .toFormat("cccc 'a las' HH:mm");
}

/** "mié 04/11" para cualquier fecha (a diferencia de `formatDeliveryDay`, no exige miércoles o viernes). */
export function formatShortDate(date: string): string {
  return parseDate(date).setLocale("es-AR").toFormat("ccc dd/LL").replace(".", "");
}

/** "30/10 14:54" en hora de Buenos Aires, para el historial. */
export function formatDateTime(instant: Date): string {
  return DateTime.fromJSDate(instant, { zone: TIME_ZONE }).toFormat("dd/LL HH:mm");
}
