import { desc, eq, inArray, sql } from "drizzle-orm";
import { orderItemDetails, orderItems, orders } from "@/db/schema";
import type { AppDb } from "@/db/types";
import type { Catalog, PackCategory } from "@/domain/catalog";
import { isSurveyOpen } from "@/domain/crm";
import { centsFromNumeric } from "@/domain/money";
import { repeatOrder, type RepeatResult } from "@/domain/repeat";
import type { OrderStatus } from "@/domain/orders";

export type AccountOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  scheduledDate: string;
  totalCents: number;
  accessToken: string;
  /** Enlace a la encuesta, solo si el pedido se entregó y todavía está abierta. */
  surveyToken: string | null;
  summary: string[];
};

const PACK_LABEL: Record<PackCategory, string> = {
  ESENCIAL: "Esenciales",
  PROTEICO: "Proteicos",
  BURRITO: "Burritos",
};

/**
 * Pedidos de una cuenta: los que se hicieron con el mismo email verificado por Google, hayan sido
 * con sesión o como invitado. Más nuevos primero. No incluye los PRELIMINAR (todavía no son pedidos).
 */
export async function listAccountOrders(
  db: AppDb,
  email: string,
  now: Date,
): Promise<AccountOrder[]> {
  const rows = await db
    .select()
    .from(orders)
    .where(
      sql`lower(${orders.customerEmail}) = ${email.toLowerCase()} and ${orders.status} <> 'PRELIMINAR'`,
    )
    .orderBy(desc(orders.createdAt))
    .limit(50);
  if (rows.length === 0) return [];

  const items = await db
    .select({
      orderId: orderItems.orderId,
      category: orderItems.category,
      tierSize: orderItems.tierSize,
    })
    .from(orderItems)
    .where(
      inArray(
        orderItems.orderId,
        rows.map((r) => r.id),
      ),
    );

  return rows.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    scheduledDate: o.scheduledDate,
    totalCents: centsFromNumeric(o.total),
    accessToken: o.accessToken,
    surveyToken:
      o.status === "ENTREGADO" && isSurveyOpen(o.deliveredAt, now) ? o.surveyToken : null,
    summary: items
      .filter((i) => i.orderId === o.id)
      .map((i) =>
        i.category === "COMPLEMENTO"
          ? "Complementos"
          : `${PACK_LABEL[i.category as PackCategory]} de ${i.tierSize}`,
      ),
  }));
}

export type RepeatLoad =
  { ok: true; result: RepeatResult; unavailableNames: string[] } | { ok: false; code: "NOT_FOUND" };

/** Arma el carrito para repetir un pedido de esta cuenta. Los precios y la fecha se piden de nuevo. */
export async function loadRepeat(
  db: AppDb,
  input: { email: string; orderId: string; catalog: Catalog },
): Promise<RepeatLoad> {
  const [order] = await db
    .select({ id: orders.id, customerEmail: orders.customerEmail })
    .from(orders)
    .where(eq(orders.id, input.orderId));
  // Un pedido de otra persona se ve igual que uno inexistente.
  if (!order || order.customerEmail?.toLowerCase() !== input.email.toLowerCase()) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const rows = await db
    .select({
      itemId: orderItems.id,
      itemType: orderItems.itemType,
      category: orderItems.category,
      tierSize: orderItems.tierSize,
      productId: orderItemDetails.productId,
      quantity: orderItemDetails.quantity,
    })
    .from(orderItems)
    .innerJoin(orderItemDetails, eq(orderItemDetails.orderItemId, orderItems.id))
    .where(eq(orderItems.orderId, order.id));

  const packs = new Map<
    string,
    { category: PackCategory; tierSize: number; details: { productId: string; quantity: number }[] }
  >();
  const complements: { productId: string; quantity: number }[] = [];
  for (const row of rows) {
    if (row.itemType === "COMPLEMENTO") {
      complements.push({ productId: row.productId, quantity: row.quantity });
      continue;
    }
    const pack = packs.get(row.itemId) ?? {
      category: row.category as PackCategory,
      tierSize: row.tierSize ?? 0,
      details: [],
    };
    pack.details.push({ productId: row.productId, quantity: row.quantity });
    packs.set(row.itemId, pack);
  }

  const result = repeatOrder({ items: [...packs.values()], complements }, input.catalog);
  const names = new Map(
    (
      await db
        .select({ id: orderItemDetails.productId, name: orderItemDetails.productName })
        .from(orderItemDetails)
        .innerJoin(orderItems, eq(orderItems.id, orderItemDetails.orderItemId))
        .where(eq(orderItems.orderId, order.id))
    ).map((r) => [r.id, r.name]),
  );
  return {
    ok: true,
    result,
    unavailableNames: result.unavailableProductIds.map((id) => names.get(id) ?? "Un plato"),
  };
}
