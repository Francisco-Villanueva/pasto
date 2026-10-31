import { gte } from "drizzle-orm";
import { loadCatalogFromDb } from "@/db/catalog";
import { deliveryDays } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { formatCutoff, formatDeliveryDay, isDayAvailable, localDate } from "@/domain/schedule";
import type { StoreCatalog } from "@/domain/store-catalog";

export type AdminDayOption = {
  date: string;
  label: string;
  slots: string[];
  /** Por qué un cliente no podría elegirlo hoy: la administración sí. */
  note: string | null;
};

export type EditorData = { catalog: StoreCatalog; days: AdminDayOption[] };

/**
 * Datos del editor de pedidos. A diferencia de la tienda, ofrece TODOS los días de la agenda de hoy en
 * adelante (también los cerrados o pasados de corte), avisando por qué un cliente no podría elegirlos.
 * `includeDate` agrega el día actual de un pedido que se está editando, aunque ya haya pasado.
 */
export async function loadEditorData(
  db: AppDb,
  now: Date,
  includeDate?: string,
): Promise<EditorData> {
  const [catalog, rows] = await Promise.all([
    loadCatalogFromDb(db),
    db
      .select()
      .from(deliveryDays)
      .where(gte(deliveryDays.date, localDate(now))),
  ]);

  const days = rows
    .filter((d) => d.slots.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((d): AdminDayOption => {
      const open = isDayAvailable(
        { date: d.date, isOpen: d.isOpen, cutoffAt: d.cutoffAt, slots: d.slots },
        now,
      );
      return {
        date: d.date,
        label: formatDeliveryDay(d.date),
        slots: d.slots,
        note: open ? null : !d.isOpen ? "día cerrado" : `cerró el ${formatCutoff(d.cutoffAt)}`,
      };
    });

  if (includeDate && !days.some((d) => d.date === includeDate)) {
    const [existing] = rows.filter((d) => d.date === includeDate);
    const slots = existing?.slots ?? [];
    days.unshift({
      date: includeDate,
      label: formatDeliveryDay(includeDate),
      slots,
      note: "fecha del pedido",
    });
  }

  return { catalog, days };
}
