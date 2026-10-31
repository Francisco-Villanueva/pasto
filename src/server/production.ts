import { and, asc, eq, inArray } from "drizzle-orm";
import { orderItemDetails, orderItems, orders } from "@/db/schema";
import type { AppDb } from "@/db/types";
import type { OrderStatus } from "@/domain/orders";
import { aggregateProduction, type ProductionRow } from "@/domain/production";
import { localDate } from "@/domain/schedule";

/** Estados que Cocina ve: lo confirmado, lo que está en la cocina y lo ya listo. */
const KITCHEN_STATUSES = ["CONFIRMADO", "EN_PRODUCCION", "LISTO"] as const satisfies OrderStatus[];

export type KitchenOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  timeSlot: string;
  deliveryType: "DELIVERY" | "RETIRO";
  /** "Esencial x5", "Complemento": sin importes ni datos del cliente. */
  items: { label: string; dishes: { productId: string; name: string; quantity: number }[] }[];
};

export type ProductionSheet = {
  date: string;
  rows: ProductionRow[];
  orders: KitchenOrder[];
};

const CATEGORY_LABEL = {
  ESENCIAL: "Esencial",
  PROTEICO: "Proteico",
  BURRITO: "Burrito",
  COMPLEMENTO: "Complemento",
} as const;

/** Fechas con algo para cocinar, de hoy en adelante (la más próxima primero). */
export async function listProductionDates(db: AppDb, now: Date): Promise<string[]> {
  const rows = await db
    .selectDistinct({ date: orders.scheduledDate })
    .from(orders)
    .where(inArray(orders.status, [...KITCHEN_STATUSES]))
    .orderBy(asc(orders.scheduledDate));
  const today = localDate(now);
  return rows.map((r) => r.date).filter((date) => date >= today);
}

/**
 * Hoja de producción de una fecha. Solo trae lo que Cocina necesita: nunca importes ni datos del cliente.
 * El total por receta cuenta CONFIRMADO y EN_PRODUCCION (lo que falta cocinar); LISTO se muestra aparte.
 */
export async function loadProductionSheet(db: AppDb, date: string): Promise<ProductionSheet> {
  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      timeSlot: orders.scheduledTimeSlot,
      deliveryType: orders.deliveryType,
      itemId: orderItems.id,
      itemType: orderItems.itemType,
      category: orderItems.category,
      tierSize: orderItems.tierSize,
      productId: orderItemDetails.productId,
      productName: orderItemDetails.productName,
      quantity: orderItemDetails.quantity,
    })
    .from(orders)
    .innerJoin(orderItems, eq(orderItems.orderId, orders.id))
    .innerJoin(orderItemDetails, eq(orderItemDetails.orderItemId, orderItems.id))
    .where(and(eq(orders.scheduledDate, date), inArray(orders.status, [...KITCHEN_STATUSES])))
    .orderBy(asc(orders.scheduledTimeSlot), asc(orders.orderNumber));

  const byOrder = new Map<string, KitchenOrder>();
  const itemIndex = new Map<string, KitchenOrder["items"][number]>();
  for (const row of rows) {
    let order = byOrder.get(row.id);
    if (!order) {
      order = {
        id: row.id,
        orderNumber: row.orderNumber,
        status: row.status,
        timeSlot: row.timeSlot,
        deliveryType: row.deliveryType,
        items: [],
      };
      byOrder.set(row.id, order);
    }
    let item = itemIndex.get(row.itemId);
    if (!item) {
      item = {
        label:
          row.itemType === "COMPLEMENTO"
            ? "Complemento"
            : `${CATEGORY_LABEL[row.category]} x${row.tierSize}`,
        dishes: [],
      };
      itemIndex.set(row.itemId, item);
      order.items.push(item);
    }
    item.dishes.push({
      productId: row.productId,
      name: row.productName,
      quantity: row.quantity,
    });
  }

  const list = [...byOrder.values()];
  const totals = aggregateProduction(
    list.map((order) => ({
      status: order.status,
      scheduledDate: date,
      items: order.items.map((item) => ({
        details: item.dishes.map((d) => ({
          productId: d.productId,
          productName: d.name,
          quantity: d.quantity,
        })),
      })),
    })),
    date,
  );

  return { date, rows: totals, orders: list };
}
