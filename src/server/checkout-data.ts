import { gte } from "drizzle-orm";
import { deliveryDays } from "@/db/schema";
import type { AppDb } from "@/db/types";
import {
  formatCutoff,
  formatDeliveryDay,
  getAvailableDeliveryDays,
  localDate,
  type DeliveryDayConfig,
} from "@/domain/schedule";

export type DayOption = {
  date: string;
  label: string;
  /** "lunes a las 12:00" */
  cutoff: string;
  slots: string[];
};

/**
 * Días que se pueden elegir ahora mismo: abiertos en la agenda y antes del corte.
 * Es solo para mostrar; al crear el pedido el servidor vuelve a validar.
 */
export async function loadAvailableDays(db: AppDb, now: Date): Promise<DayOption[]> {
  const rows = await db
    .select()
    .from(deliveryDays)
    .where(gte(deliveryDays.date, localDate(now)));
  const days: DeliveryDayConfig[] = rows.map((d) => ({
    date: d.date,
    isOpen: d.isOpen,
    cutoffAt: d.cutoffAt,
    slots: d.slots,
  }));

  return getAvailableDeliveryDays(now, days)
    .filter((day) => day.slots.length > 0)
    .map((day) => ({
      date: day.date,
      label: formatDeliveryDay(day.date),
      cutoff: formatCutoff(day.cutoffAt),
      slots: [...day.slots],
    }));
}
