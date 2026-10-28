import { isCountedInProduction, type OrderStatus } from "./orders";

export type ProductionOrder = {
  status: OrderStatus;
  scheduledDate: string;
  items: readonly {
    details: readonly { productId: string; productName: string; quantity: number }[];
  }[];
};

export type ProductionRow = { productId: string; productName: string; units: number };

/**
 * Unidades de cada receta para una fecha, sin importar cómo vinieron armados los packs.
 * Solo entran pedidos CONFIRMADO o EN_PRODUCCION. No lleva importes (Cocina no los ve).
 */
export function aggregateProduction(
  orders: readonly ProductionOrder[],
  scheduledDate: string,
): ProductionRow[] {
  const totals = new Map<string, ProductionRow>();

  for (const order of orders) {
    if (order.scheduledDate !== scheduledDate || !isCountedInProduction(order.status)) continue;
    for (const item of order.items) {
      for (const detail of item.details) {
        const row = totals.get(detail.productId);
        if (row) row.units += detail.quantity;
        else {
          totals.set(detail.productId, {
            productId: detail.productId,
            productName: detail.productName,
            units: detail.quantity,
          });
        }
      }
    }
  }

  return [...totals.values()].sort((a, b) => a.productName.localeCompare(b.productName, "es"));
}

export function formatProductionRow(row: ProductionRow): string {
  return `${row.productName}: ${row.units} ${row.units === 1 ? "unidad" : "unidades"}`;
}

/** CSV con punto y coma, que es lo que Excel en español abre en columnas. */
export function productionToCsv(rows: readonly ProductionRow[]): string {
  const escape = (value: string) =>
    /[";\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  return ["Producto;Unidades", ...rows.map((r) => `${escape(r.productName)};${r.units}`)].join(
    "\r\n",
  );
}
