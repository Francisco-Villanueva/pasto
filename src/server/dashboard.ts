import { and, count, eq, gte, inArray, min, ne, sql } from "drizzle-orm";
import { orders } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { centsFromNumeric, type Cents } from "@/domain/money";
import { ORDER_STATUSES, isCountedInRevenue } from "@/domain/orders";
import { localDate } from "@/domain/schedule";

export type Dashboard = {
  /** Pedidos que esperan una decisión del admin. */
  toConfirm: number;
  /** Pedidos preliminares: el cliente todavía no escribió por WhatsApp. */
  preliminary: number;
  /** Envíos que Pasto tiene que cotizar a mano. */
  feeToConfirm: number;
  /** Próxima fecha con pedidos activos y su resumen, o nulo si no hay ninguna. */
  next: {
    date: string;
    orders: number;
    /** Solo pedidos confirmados en adelante (nunca preliminares ni cancelados). */
    revenueCents: Cents;
    unpaid: number;
  } | null;
};

const REVENUE_STATUSES = ORDER_STATUSES.filter(isCountedInRevenue);

async function countWhere(db: AppDb, where: ReturnType<typeof and>) {
  const [row] = await db.select({ total: count() }).from(orders).where(where);
  return row?.total ?? 0;
}

/** Números del panel de administración. Incluye importes: solo para quien tiene FINANCIALS_VIEW. */
export async function loadDashboard(db: AppDb, now: Date): Promise<Dashboard> {
  const today = localDate(now);

  const [toConfirm, preliminary, feeToConfirm, [nextRow]] = await Promise.all([
    countWhere(db, eq(orders.status, "PENDIENTE_CONFIRMACION")),
    countWhere(db, eq(orders.status, "PRELIMINAR")),
    countWhere(
      db,
      and(eq(orders.deliveryFeeStatus, "A_CONFIRMAR"), ne(orders.status, "CANCELADO")),
    ),
    db
      .select({ date: min(orders.scheduledDate) })
      .from(orders)
      .where(and(gte(orders.scheduledDate, today), ne(orders.status, "CANCELADO"))),
  ]);

  const date = nextRow?.date ?? null;
  if (!date) return { toConfirm, preliminary, feeToConfirm, next: null };

  const [summary] = await db
    .select({
      total: count(),
      revenue: sql<string>`coalesce(sum(${orders.total}) filter (where ${inArray(orders.status, REVENUE_STATUSES)}), 0)`,
      unpaid: sql<number>`count(*) filter (where ${inArray(orders.status, REVENUE_STATUSES)} and ${orders.paymentStatus} = 'PENDIENTE')::int`,
    })
    .from(orders)
    .where(and(eq(orders.scheduledDate, date), ne(orders.status, "CANCELADO")));

  return {
    toConfirm,
    preliminary,
    feeToConfirm,
    next: {
      date,
      orders: summary?.total ?? 0,
      revenueCents: centsFromNumeric(summary?.revenue ?? 0),
      unpaid: summary?.unpaid ?? 0,
    },
  };
}
