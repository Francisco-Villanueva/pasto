import { and, eq, lte } from "drizzle-orm";
import { loadSettingsFromDb } from "@/db/catalog";
import { orders } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { parseStoreSettings } from "@/domain/settings";
import { logChange } from "./order-store";

export const ABANDONMENT_REASON =
  "Cancelado automáticamente: el cliente no confirmó el pedido en el plazo.";

/**
 * Cancela los pedidos PRELIMINAR que superaron el plazo de abandono. Con la regla desactivada (0 horas)
 * no hace nada. Es reversible: el admin puede reactivar el pedido desde el detalle. Cada cancelación
 * queda en el historial a nombre del sistema. Devuelve cuántos canceló.
 */
export async function cancelAbandonedOrders(db: AppDb, now: Date): Promise<number> {
  const { abandonAfterHours } = parseStoreSettings(await loadSettingsFromDb(db));
  if (abandonAfterHours === null) return 0;

  const limit = new Date(now.getTime() - abandonAfterHours * 3_600_000);

  return db.transaction(async (tx) => {
    // Un solo UPDATE con el filtro de estado: si el pedido avanzó mientras tanto, no se toca.
    const cancelled = await tx
      .update(orders)
      .set({ status: "CANCELADO", cancellationReason: ABANDONMENT_REASON, updatedAt: now })
      .where(and(eq(orders.status, "PRELIMINAR"), lte(orders.createdAt, limit)))
      .returning({ id: orders.id });

    for (const { id } of cancelled) {
      await logChange(tx, {
        orderId: id,
        kind: "ESTADO",
        actorId: null,
        before: { status: "PRELIMINAR" },
        after: { status: "CANCELADO" },
        note: ABANDONMENT_REASON,
        at: now,
      });
    }
    return cancelled.length;
  });
}
