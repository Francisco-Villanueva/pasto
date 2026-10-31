import { and, count, eq, gte, inArray, ne } from "drizzle-orm";
import { loadSettingsFromDb } from "@/db/catalog";
import { deliveryDays, orders, settings, shippingTiers } from "@/db/schema";
import type { AppDb } from "@/db/types";
import {
  type AgendaIssue,
  type TierInput,
  validateAbandonHours,
  validateShipping,
  validateSlots,
} from "@/domain/agenda";
import { centsFromNumeric, numericFromCents } from "@/domain/money";
import { formatCutoff, generateDeliveryDays, localDate, weekdayOf } from "@/domain/schedule";
import { parseStoreSettings } from "@/domain/settings";
import { DEFAULT_SLOTS } from "@/db/seed-data";

/** Cuántas semanas hacia adelante se muestran en la agenda. */
export const AGENDA_WEEKS = 8;

export type AgendaDay = {
  date: string;
  weekday: "MIERCOLES" | "VIERNES";
  isOpen: boolean;
  /** "lunes a las 12:00" */
  cutoff: string;
  cutoffPassed: boolean;
  slots: string[];
  /** Pedidos activos (sin cancelar) para esa fecha: avisa antes de cerrar un día con pedidos. */
  activeOrders: number;
};

export type AgendaData = {
  days: AgendaDay[];
  tiers: TierInput[];
  maxDistanceM: number;
  abandonAfterHours: number | null;
  defaultSlots: string[];
};

/**
 * Agenda de las próximas semanas. Si faltan fechas (la semana avanzó y nadie las cargó), las crea con
 * el borrador estándar: miércoles abiertos y viernes cerrados. Nunca pisa lo que el admin ya tocó.
 */
export async function loadAgenda(db: AppDb, now: Date): Promise<AgendaData> {
  const raw = await loadSettingsFromDb(db);
  const store = parseStoreSettings(raw);
  const defaultSlots = store.defaultSlots.length > 0 ? store.defaultSlots : DEFAULT_SLOTS;

  const draft = generateDeliveryDays(now, { weeks: AGENDA_WEEKS, defaultSlots });
  if (draft.length > 0) {
    await db
      .insert(deliveryDays)
      .values(
        draft.map((d) => ({
          date: d.date,
          isOpen: d.isOpen,
          cutoffAt: d.cutoffAt,
          slots: [...d.slots],
        })),
      )
      .onConflictDoNothing();
  }

  const today = localDate(now);
  const [dayRows, tierRows, counts] = await Promise.all([
    db.select().from(deliveryDays).where(gte(deliveryDays.date, today)),
    db.select().from(shippingTiers),
    db
      .select({ date: orders.scheduledDate, total: count() })
      .from(orders)
      .where(and(gte(orders.scheduledDate, today), ne(orders.status, "CANCELADO")))
      .groupBy(orders.scheduledDate),
  ]);
  const activeByDate = new Map(counts.map((c) => [c.date, c.total]));

  const days: AgendaDay[] = dayRows
    .filter((d) => weekdayOf(d.date) !== null)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d) => ({
      date: d.date,
      weekday: weekdayOf(d.date)!,
      isOpen: d.isOpen,
      cutoff: formatCutoff(d.cutoffAt),
      cutoffPassed: now.getTime() >= d.cutoffAt.getTime(),
      slots: d.slots,
      activeOrders: activeByDate.get(d.date) ?? 0,
    }));

  return {
    days,
    tiers: tierRows
      .map((t) => ({ upToM: t.upToM, feeCents: centsFromNumeric(t.fee) }))
      .sort((a, b) => a.upToM - b.upToM),
    maxDistanceM: store.maxDistanceM,
    abandonAfterHours: store.abandonAfterHours,
    defaultSlots,
  };
}

export type AgendaResult = { ok: true } | { ok: false; code: AgendaIssue | "NOT_FOUND" };

/** Abre o cierra un día y define sus franjas. */
export async function updateDay(
  db: AppDb,
  params: { date: string; isOpen: boolean; slots: string[] },
): Promise<AgendaResult> {
  const slots = validateSlots(params.slots);
  if (!slots.ok) return { ok: false, code: slots.issue };
  // Un día abierto sin franjas no se podría pedir: es un error de carga, no un caso válido.
  if (params.isOpen && slots.slots.length === 0) return { ok: false, code: "SLOTS_EMPTY_NAME" };

  const updated = await db
    .update(deliveryDays)
    .set({ isOpen: params.isOpen, slots: slots.slots })
    .where(eq(deliveryDays.date, params.date))
    .returning({ id: deliveryDays.id });
  return updated.length === 0 ? { ok: false, code: "NOT_FOUND" } : { ok: true };
}

async function upsertSetting(db: AppDb, key: string, value: unknown) {
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } });
}

/** Reemplaza la tabla de tramos y el radio máximo, en conjunto, para que nunca queden a medias. */
export async function saveShipping(
  db: AppDb,
  params: { tiers: TierInput[]; maxDistanceM: number },
): Promise<AgendaResult> {
  const valid = validateShipping(params.tiers, params.maxDistanceM);
  if (!valid.ok) return { ok: false, code: valid.issue };

  await db.transaction(async (tx) => {
    const keep = valid.tiers.map((t) => t.upToM);
    for (const tier of valid.tiers) {
      await tx
        .insert(shippingTiers)
        .values({ upToM: tier.upToM, fee: numericFromCents(tier.feeCents) })
        .onConflictDoUpdate({
          target: shippingTiers.upToM,
          set: { fee: numericFromCents(tier.feeCents) },
        });
    }
    const existing = await tx.select({ upToM: shippingTiers.upToM }).from(shippingTiers);
    const remove = existing.map((t) => t.upToM).filter((m) => !keep.includes(m));
    if (remove.length > 0)
      await tx.delete(shippingTiers).where(inArray(shippingTiers.upToM, remove));
    await tx
      .insert(settings)
      .values({ key: "delivery_max_distance_m", value: params.maxDistanceM })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: params.maxDistanceM, updatedAt: new Date() },
      });
  });
  return { ok: true };
}

/** Plazo de abandono (0 = desactivado) y franjas que se proponen al abrir fechas nuevas. */
export async function saveGeneralSettings(
  db: AppDb,
  params: { abandonAfterHours: number; defaultSlots: string[] },
): Promise<AgendaResult> {
  if (!validateAbandonHours(params.abandonAfterHours)) {
    return { ok: false, code: "ABANDON_INVALID" };
  }
  const slots = validateSlots(params.defaultSlots);
  if (!slots.ok) return { ok: false, code: slots.issue };
  if (slots.slots.length === 0) return { ok: false, code: "SLOTS_EMPTY_NAME" };

  await upsertSetting(db, "abandon_after_hours", params.abandonAfterHours);
  await upsertSetting(db, "default_slots", slots.slots);
  return { ok: true };
}
