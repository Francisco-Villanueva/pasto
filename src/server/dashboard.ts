import { and, asc, count, eq, gte, inArray, lte, min, ne, sql } from "drizzle-orm";
import { crmTasks, orders } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { centsFromNumeric, type Cents } from "@/domain/money";
import { ORDER_STATUSES, isCountedInRevenue, type OrderStatus } from "@/domain/orders";
import { localDate } from "@/domain/schedule";

export type Dashboard = {
  /** Pedidos que esperan una decisión del admin. */
  toConfirm: number;
  /** Pedidos preliminares: el cliente todavía no escribió por WhatsApp. */
  preliminary: number;
  /** Envíos que Pasto tiene que cotizar a mano. */
  feeToConfirm: number;
  /** Seguimientos D+5/D+12 vencidos o de hoy. */
  followUpsDue: number;
  /** Pedidos activos (sin cancelados) por estado, para ver dónde se acumulan. */
  byStatus: Record<OrderStatus, number>;
  /** Próximas fechas de entrega con pedidos (hasta 7), con cantidad e importe confirmado. */
  upcoming: { date: string; orders: number; revenueCents: Cents }[];
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

  const [toConfirm, preliminary, feeToConfirm, followUpsDue, statusRows, upcomingRows, [nextRow]] =
    await Promise.all([
      countWhere(db, eq(orders.status, "PENDIENTE_CONFIRMACION")),
      countWhere(db, eq(orders.status, "PRELIMINAR")),
      countWhere(
        db,
        and(eq(orders.deliveryFeeStatus, "A_CONFIRMAR"), ne(orders.status, "CANCELADO")),
      ),
      countFollowUps(db, today),
      db.select({ status: orders.status, total: count() }).from(orders).groupBy(orders.status),
      db
        .select({
          date: orders.scheduledDate,
          total: count(),
          revenue: sql<string>`coalesce(sum(${orders.total}) filter (where ${inArray(orders.status, REVENUE_STATUSES)}), 0)`,
        })
        .from(orders)
        .where(and(gte(orders.scheduledDate, today), ne(orders.status, "CANCELADO")))
        .groupBy(orders.scheduledDate)
        .orderBy(asc(orders.scheduledDate))
        .limit(7),
      db
        .select({ date: min(orders.scheduledDate) })
        .from(orders)
        .where(and(gte(orders.scheduledDate, today), ne(orders.status, "CANCELADO"))),
    ]);

  const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<
    OrderStatus,
    number
  >;
  for (const row of statusRows) byStatus[row.status] = row.total;
  const upcoming = upcomingRows.map((row) => ({
    date: row.date,
    orders: row.total,
    revenueCents: centsFromNumeric(row.revenue),
  }));
  const base = { toConfirm, preliminary, feeToConfirm, followUpsDue, byStatus, upcoming };

  const date = nextRow?.date ?? null;
  if (!date) return { ...base, next: null };

  const [summary] = await db
    .select({
      total: count(),
      revenue: sql<string>`coalesce(sum(${orders.total}) filter (where ${inArray(orders.status, REVENUE_STATUSES)}), 0)`,
      unpaid: sql<number>`count(*) filter (where ${inArray(orders.status, REVENUE_STATUSES)} and ${orders.paymentStatus} = 'PENDIENTE')::int`,
    })
    .from(orders)
    .where(and(eq(orders.scheduledDate, date), ne(orders.status, "CANCELADO")));

  return {
    ...base,
    next: {
      date,
      orders: summary?.total ?? 0,
      revenueCents: centsFromNumeric(summary?.revenue ?? 0),
      unpaid: summary?.unpaid ?? 0,
    },
  };
}

async function countFollowUps(db: AppDb, today: string) {
  const [row] = await db
    .select({ total: count() })
    .from(crmTasks)
    .where(and(eq(crmTasks.status, "PENDIENTE"), lte(crmTasks.scheduledFor, today)));
  return row?.total ?? 0;
}

/** Globos de la barra lateral: lo que espera una acción. Solo cantidades, sin importes. */
export type NavBadges = { pedidos: number; crm: number };

export async function loadNavBadges(db: AppDb, now: Date): Promise<NavBadges> {
  const [pedidos, crm] = await Promise.all([
    countWhere(db, eq(orders.status, "PENDIENTE_CONFIRMACION")),
    countFollowUps(db, localDate(now)),
  ]);
  return { pedidos, crm };
}
