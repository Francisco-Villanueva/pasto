import { and, asc, count, desc, eq, gt, lte, ne } from "drizzle-orm";
import { crmTasks, orders } from "@/db/schema";
import type { AppDb } from "@/db/types";
import type { CrmTaskType } from "@/domain/crm";
import { localDate } from "@/domain/schedule";

export type CrmView = "HOY" | "PROXIMAS" | "HECHAS";

export type CrmTaskRow = {
  id: string;
  type: CrmTaskType;
  scheduledFor: string;
  status: "PENDIENTE" | "COMPLETADA" | "OMITIDA";
  resultNotes: string | null;
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  surveyToken: string;
  completedAt: Date | null;
};

const columns = {
  id: crmTasks.id,
  type: crmTasks.type,
  scheduledFor: crmTasks.scheduledFor,
  status: crmTasks.status,
  resultNotes: crmTasks.resultNotes,
  orderId: orders.id,
  orderNumber: orders.orderNumber,
  customerName: orders.customerName,
  customerPhone: orders.customerPhone,
  surveyToken: orders.surveyToken,
  completedAt: crmTasks.completedAt,
};

/**
 * Tareas de seguimiento. "Hoy" son las pendientes que ya vencieron o vencen hoy (las atrasadas primero);
 * "Próximas", las pendientes de días siguientes; "Hechas", las completadas u omitidas, la última primero.
 */
export async function listCrmTasks(db: AppDb, now: Date, view: CrmView): Promise<CrmTaskRow[]> {
  const today = localDate(now);
  const base = db.select(columns).from(crmTasks).innerJoin(orders, eq(orders.id, crmTasks.orderId));

  switch (view) {
    case "HOY":
      return base
        .where(and(eq(crmTasks.status, "PENDIENTE"), lte(crmTasks.scheduledFor, today)))
        .orderBy(asc(crmTasks.scheduledFor), asc(orders.orderNumber));
    case "PROXIMAS":
      return base
        .where(and(eq(crmTasks.status, "PENDIENTE"), gt(crmTasks.scheduledFor, today)))
        .orderBy(asc(crmTasks.scheduledFor), asc(orders.orderNumber))
        .limit(100);
    case "HECHAS":
      return base
        .where(ne(crmTasks.status, "PENDIENTE"))
        .orderBy(desc(crmTasks.completedAt))
        .limit(100);
  }
}

/** Cantidad de tareas pendientes para hoy (o atrasadas) y para los próximos días, para las solapas. */
export async function countCrmTasks(
  db: AppDb,
  now: Date,
): Promise<{ today: number; upcoming: number }> {
  const today = localDate(now);
  const rows = await db
    .select({ scheduledFor: crmTasks.scheduledFor, total: count() })
    .from(crmTasks)
    .where(eq(crmTasks.status, "PENDIENTE"))
    .groupBy(crmTasks.scheduledFor);
  let due = 0;
  let upcoming = 0;
  for (const row of rows) {
    if (row.scheduledFor <= today) due += row.total;
    else upcoming += row.total;
  }
  return { today: due, upcoming };
}

/** Cuántas tareas hay para hoy (para el panel y el menú). */
export async function countDueTasks(db: AppDb, now: Date): Promise<number> {
  return (await listCrmTasks(db, now, "HOY")).length;
}

export type ResolveTaskResult =
  { ok: true } | { ok: false; code: "NOT_FOUND" | "ALREADY_RESOLVED" | "REASON_REQUIRED" };

/** Completa una tarea o la omite (con motivo obligatorio). Una tarea ya resuelta no se toca de nuevo. */
export async function resolveTask(
  db: AppDb,
  params: {
    taskId: string;
    outcome: "COMPLETADA" | "OMITIDA";
    actorId: string;
    notes?: string;
    now?: Date;
  },
): Promise<ResolveTaskResult> {
  const notes = params.notes?.trim() || null;
  if (params.outcome === "OMITIDA" && !notes) return { ok: false, code: "REASON_REQUIRED" };

  // El filtro por estado hace de candado: dos personas no resuelven la misma tarea.
  const updated = await db
    .update(crmTasks)
    .set({
      status: params.outcome,
      resultNotes: notes,
      operatorId: params.actorId,
      completedAt: params.now ?? new Date(),
    })
    .where(and(eq(crmTasks.id, params.taskId), eq(crmTasks.status, "PENDIENTE")))
    .returning({ id: crmTasks.id });
  if (updated.length > 0) return { ok: true };

  const [exists] = await db
    .select({ id: crmTasks.id })
    .from(crmTasks)
    .where(eq(crmTasks.id, params.taskId));
  return { ok: false, code: exists ? "ALREADY_RESOLVED" : "NOT_FOUND" };
}
