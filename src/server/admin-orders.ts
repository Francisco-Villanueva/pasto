import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { loadSettingsFromDb } from "@/db/catalog";
import {
  crmTasks,
  orderChanges,
  orderItemDetails,
  orderItems,
  orders,
  users,
  type DeliveryAddress,
} from "@/db/schema";
import type { AppDb } from "@/db/types";
import { buildCrmTasks } from "@/domain/crm";
import { centsFromNumeric, numericFromCents } from "@/domain/money";
import { buildOrderDraft, type DraftError, type OrderDraft } from "@/domain/order-draft";
import { describeEdit, formatAddress, itemLabels, type OrderSnapshot } from "@/domain/order-diff";
import {
  checkTransition,
  isEditableByAdmin,
  type OrderStatus,
  type StaffRole,
} from "@/domain/orders";
import { normalizeArPhone } from "@/domain/phone";
import { parseStoreSettings } from "@/domain/settings";
import type { AdminOrderInput } from "@/lib/admin-order-schema";
import { loadDraftContext, type DistanceFor } from "./draft-context";
import { insertItems, logChange, upsertCustomer, type Tx } from "./order-store";

export const PAGE_SIZE = 25;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------------------------
// Listado
// ---------------------------------------------------------------------------------------------

export type OrderFilters = {
  /** Fecha de entrega, `YYYY-MM-DD`. */
  date?: string;
  status?: OrderStatus;
  deliveryType?: "DELIVERY" | "RETIRO";
  paymentStatus?: "PENDIENTE" | "PAGADO";
  /** Número de pedido, nombre o teléfono. */
  q?: string;
  page?: number;
};

export type OrderListRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  scheduledDate: string;
  scheduledTimeSlot: string;
  deliveryType: "DELIVERY" | "RETIRO";
  status: OrderStatus;
  paymentStatus: "PENDIENTE" | "PAGADO";
  totalCents: number;
  /** Envío sin definir: se confirma por WhatsApp. */
  feeToConfirm: boolean;
  origin: "WEB" | "MANUAL";
  createdAt: Date;
};

export type OrderList = { rows: OrderListRow[]; total: number; page: number; pageCount: number };

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listOrders(db: AppDb, filters: OrderFilters = {}): Promise<OrderList> {
  const conditions: SQL[] = [];
  if (filters.date) conditions.push(eq(orders.scheduledDate, filters.date));
  if (filters.status) conditions.push(eq(orders.status, filters.status));
  if (filters.deliveryType) conditions.push(eq(orders.deliveryType, filters.deliveryType));
  if (filters.paymentStatus) conditions.push(eq(orders.paymentStatus, filters.paymentStatus));

  const text = filters.q?.trim();
  if (text) {
    const digits = text.replace(/\D/g, "");
    const matches = [
      ilike(orders.orderNumber, `%${escapeLike(text)}%`),
      ilike(orders.customerName, `%${escapeLike(text)}%`),
    ];
    // El teléfono se guarda como +549…: se busca por los dígitos que escribió la persona.
    if (digits.length >= 3) matches.push(ilike(orders.customerPhone, `%${digits}%`));
    conditions.push(or(...matches)!);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const [counted] = await db.select({ total: count() }).from(orders).where(where);
  const total = counted?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.floor(filters.page ?? 1)), pageCount);

  const rows = await db
    .select()
    .from(orders)
    .where(where)
    .orderBy(desc(orders.scheduledDate), desc(orders.createdAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE);

  return {
    rows: rows.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      customerPhone: o.customerPhone,
      scheduledDate: o.scheduledDate,
      scheduledTimeSlot: o.scheduledTimeSlot,
      deliveryType: o.deliveryType,
      status: o.status,
      paymentStatus: o.paymentStatus,
      totalCents: centsFromNumeric(o.total),
      feeToConfirm: o.deliveryFeeStatus === "A_CONFIRMAR",
      origin: o.origin,
      createdAt: o.createdAt,
    })),
    total,
    page,
    pageCount,
  };
}

/** Fechas de entrega que tienen pedidos, para el filtro. */
export async function listOrderDates(db: AppDb): Promise<string[]> {
  const rows = await db
    .selectDistinct({ date: orders.scheduledDate })
    .from(orders)
    .orderBy(desc(orders.scheduledDate))
    .limit(60);
  return rows.map((r) => r.date);
}

// ---------------------------------------------------------------------------------------------
// Detalle
// ---------------------------------------------------------------------------------------------

export type OrderDetail = {
  id: string;
  orderNumber: string;
  origin: "WEB" | "MANUAL";
  status: OrderStatus;
  cancellationReason: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  deliveryType: "DELIVERY" | "RETIRO";
  address: DeliveryAddress | null;
  deliveryDistanceM: number | null;
  deliveryFeeStatus: "NO_APLICA" | "CALCULADO" | "A_CONFIRMAR";
  scheduledDate: string;
  scheduledTimeSlot: string;
  subtotalCents: number;
  deliveryFeeCents: number | null;
  totalCents: number;
  paymentMethod: "EFECTIVO" | "TRANSFERENCIA" | "PENDIENTE";
  paymentStatus: "PENDIENTE" | "PAGADO";
  createdAt: Date;
  deliveredAt: Date | null;
  items: {
    id: string;
    itemType: "PACK" | "BURRITO_PACK" | "COMPLEMENTO";
    tierSize: number | null;
    category: "ESENCIAL" | "PROTEICO" | "BURRITO" | "COMPLEMENTO";
    totalPriceCents: number;
    details: { productId: string; productName: string; quantity: number }[];
  }[];
  changes: {
    id: string;
    kind: "ESTADO" | "EDICION" | "PAGO";
    at: Date;
    actor: string | null;
    note: string | null;
    before: unknown;
    after: unknown;
  }[];
};

export async function getOrderDetail(db: AppDb, id: string): Promise<OrderDetail | null> {
  if (!UUID.test(id)) return null;
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return null;

  const itemRows = await db
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, id))
    .orderBy(asc(orderItems.itemType), asc(orderItems.tierSize));
  const items: OrderDetail["items"] = [];
  for (const item of itemRows) {
    const details = await db
      .select()
      .from(orderItemDetails)
      .where(eq(orderItemDetails.orderItemId, item.id))
      .orderBy(asc(orderItemDetails.productName));
    items.push({
      id: item.id,
      itemType: item.itemType,
      tierSize: item.tierSize,
      category: item.category,
      totalPriceCents: centsFromNumeric(item.totalPrice),
      details: details.map((d) => ({
        productId: d.productId,
        productName: d.productName,
        quantity: d.quantity,
      })),
    });
  }

  const changeRows = await db
    .select({ change: orderChanges, actorName: users.fullName, actorEmail: users.email })
    .from(orderChanges)
    .leftJoin(users, eq(users.id, orderChanges.changedBy))
    .where(eq(orderChanges.orderId, id))
    .orderBy(desc(orderChanges.changedAt));

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    origin: order.origin,
    status: order.status,
    cancellationReason: order.cancellationReason,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    customerEmail: order.customerEmail,
    deliveryType: order.deliveryType,
    address: order.deliveryAddress,
    deliveryDistanceM: order.deliveryDistanceM,
    deliveryFeeStatus: order.deliveryFeeStatus,
    scheduledDate: order.scheduledDate,
    scheduledTimeSlot: order.scheduledTimeSlot,
    subtotalCents: centsFromNumeric(order.subtotal),
    deliveryFeeCents: order.deliveryFee === null ? null : centsFromNumeric(order.deliveryFee),
    totalCents: centsFromNumeric(order.total),
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    createdAt: order.createdAt,
    deliveredAt: order.deliveredAt,
    items,
    changes: changeRows.map(({ change, actorName, actorEmail }) => ({
      id: change.id,
      kind: change.kind,
      at: change.changedAt,
      actor: change.changedBy ? (actorName ?? actorEmail ?? "Usuario eliminado") : null,
      note: change.note,
      before: change.before,
      after: change.after,
    })),
  };
}

// ---------------------------------------------------------------------------------------------
// Estado y pago
// ---------------------------------------------------------------------------------------------

export type ChangeStatusResult =
  | { ok: true; from: OrderStatus; to: OrderStatus }
  | {
      ok: false;
      code:
        "NOT_FOUND" | "SAME_STATUS" | "FORBIDDEN_ROLE" | "INVALID_TRANSITION" | "REASON_REQUIRED";
    };

/**
 * Cambia el estado de un pedido respetando la matriz del dominio y el rol. Al entregar crea las tareas
 * de seguimiento (D+5 y D+12) sin duplicarlas; al corregir una entrega borra las pendientes.
 */
export async function changeOrderStatus(
  db: AppDb,
  params: {
    orderId: string;
    to: OrderStatus;
    role: StaffRole;
    actorId: string;
    /** Obligatorio al cancelar. */
    reason?: string;
    now?: Date;
  },
): Promise<ChangeStatusResult> {
  if (!UUID.test(params.orderId)) return { ok: false, code: "NOT_FOUND" };
  const now = params.now ?? new Date();

  return db.transaction(async (tx): Promise<ChangeStatusResult> => {
    // El bloqueo evita que dos personas cambien el mismo pedido a la vez.
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, params.orderId))
      .for("update")
      .limit(1);
    if (!order) return { ok: false, code: "NOT_FOUND" };

    const transition = checkTransition(order.status, params.to, params.role);
    if (!transition.allowed) return { ok: false, code: transition.reason };

    const reason = params.reason?.trim();
    if (transition.effects.requiresCancellationReason && !reason) {
      return { ok: false, code: "REASON_REQUIRED" };
    }

    const { effects } = transition;
    await tx
      .update(orders)
      .set({
        status: params.to,
        updatedAt: now,
        ...(effects.requiresCancellationReason ? { cancellationReason: reason } : {}),
        ...(effects.clearCancellationReason ? { cancellationReason: null } : {}),
        ...(effects.markDelivered ? { deliveredAt: now } : {}),
        ...(effects.undoDelivery ? { deliveredAt: null } : {}),
      })
      .where(eq(orders.id, order.id));

    if (effects.markDelivered) {
      const tasks = buildCrmTasks({ deliveredAt: now, scheduledDate: order.scheduledDate });
      await tx
        .insert(crmTasks)
        .values(
          tasks.map((task) => ({
            orderId: order.id,
            customerId: order.customerId,
            type: task.type,
            scheduledFor: task.scheduledFor,
          })),
        )
        // Una sola tarea por pedido y tipo: si ya existía (por ejemplo, ya completada), se conserva.
        .onConflictDoNothing();
    }
    if (effects.undoDelivery) {
      await tx
        .delete(crmTasks)
        .where(and(eq(crmTasks.orderId, order.id), eq(crmTasks.status, "PENDIENTE")));
    }

    await logChange(tx, {
      orderId: order.id,
      kind: "ESTADO",
      actorId: params.actorId,
      before: { status: order.status },
      after: { status: params.to },
      note: reason,
      at: now,
    });

    return { ok: true, from: order.status, to: params.to };
  });
}

export type UpdatePaymentResult =
  { ok: true } | { ok: false; code: "NOT_FOUND" | "NOTHING_TO_CHANGE" };

export async function updatePayment(
  db: AppDb,
  params: {
    orderId: string;
    method?: "EFECTIVO" | "TRANSFERENCIA" | "PENDIENTE";
    status?: "PENDIENTE" | "PAGADO";
    actorId: string;
    now?: Date;
  },
): Promise<UpdatePaymentResult> {
  if (!UUID.test(params.orderId)) return { ok: false, code: "NOT_FOUND" };
  const now = params.now ?? new Date();

  return db.transaction(async (tx): Promise<UpdatePaymentResult> => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, params.orderId))
      .for("update")
      .limit(1);
    if (!order) return { ok: false, code: "NOT_FOUND" };

    const method = params.method ?? order.paymentMethod;
    const status = params.status ?? order.paymentStatus;
    if (method === order.paymentMethod && status === order.paymentStatus) {
      return { ok: false, code: "NOTHING_TO_CHANGE" };
    }

    await tx
      .update(orders)
      .set({ paymentMethod: method, paymentStatus: status, updatedAt: now })
      .where(eq(orders.id, order.id));
    await logChange(tx, {
      orderId: order.id,
      kind: "PAGO",
      actorId: params.actorId,
      before: { method: order.paymentMethod, status: order.paymentStatus },
      after: { method, status },
      at: now,
    });
    return { ok: true };
  });
}

// ---------------------------------------------------------------------------------------------
// Edición y alta manual
// ---------------------------------------------------------------------------------------------

export type SaveOrderResult =
  | { ok: true; order: { id: string; orderNumber: string }; changes: string[] }
  | { ok: false; code: "NOT_FOUND" | "NOT_EDITABLE" }
  | { ok: false; code: "INVALID_ORDER"; errors: DraftError[] };

type Deps = { now?: Date; distanceFor?: DistanceFor };

function snapshotFromDraft(
  input: AdminOrderInput,
  phone: string,
  draft: OrderDraft,
): OrderSnapshot {
  return {
    scheduledDate: input.scheduledDate,
    timeSlot: input.timeSlot,
    deliveryType: input.deliveryType,
    address: input.deliveryType === "DELIVERY" ? formatAddress(input.address ?? null) : null,
    items: itemLabels(draft.items),
    subtotalCents: draft.subtotalCents,
    deliveryFeeCents: draft.deliveryFeeCents,
    totalCents: draft.totalCents,
    customerName: input.customer.name,
    customerPhone: phone,
  };
}

async function snapshotFromDb(tx: Tx, orderId: string): Promise<OrderSnapshot> {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const itemRows = await tx
    .select()
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))
    .orderBy(asc(orderItems.itemType), asc(orderItems.tierSize));
  const items = [];
  for (const item of itemRows) {
    const details = await tx
      .select()
      .from(orderItemDetails)
      .where(eq(orderItemDetails.orderItemId, item.id))
      .orderBy(asc(orderItemDetails.productName));
    items.push({ category: item.category, tierSize: item.tierSize, details });
  }

  return {
    scheduledDate: order!.scheduledDate,
    timeSlot: order!.scheduledTimeSlot,
    deliveryType: order!.deliveryType,
    address: order!.deliveryType === "DELIVERY" ? formatAddress(order!.deliveryAddress) : null,
    items: itemLabels(items),
    subtotalCents: centsFromNumeric(order!.subtotal),
    deliveryFeeCents: order!.deliveryFee === null ? null : centsFromNumeric(order!.deliveryFee),
    totalCents: centsFromNumeric(order!.total),
    customerName: order!.customerName,
    customerPhone: order!.customerPhone,
  };
}

async function prepareDraft(db: AppDb, input: AdminOrderInput, deps: Deps) {
  const now = deps.now ?? new Date();
  const settings = parseStoreSettings(await loadSettingsFromDb(db));
  const phone = normalizeArPhone(input.customer.phone)!;

  const result = buildOrderDraft(
    {
      cart: input.cart,
      deliveryType: input.deliveryType,
      hasAddress: Boolean(input.address),
      scheduledDate: input.scheduledDate,
      timeSlot: input.timeSlot,
      deliveryFeeOverrideCents: input.deliveryFeeCents ?? null,
    },
    await loadDraftContext(db, settings, {
      scheduledDate: input.scheduledDate,
      deliveryType: input.deliveryType,
      placeId: input.placeId,
      now,
      adminOverride: true,
      distanceFor: deps.distanceFor,
    }),
  );
  return { now, phone, result };
}

/**
 * Edita un pedido que todavía no se confirmó. Recalcula todo con los precios y la agenda vigentes,
 * reemplaza los ítems y deja en el historial qué cambió, quién y cuándo.
 */
export async function updateOrder(
  db: AppDb,
  params: { orderId: string; input: AdminOrderInput; actorId: string } & Deps,
): Promise<SaveOrderResult> {
  if (!UUID.test(params.orderId)) return { ok: false, code: "NOT_FOUND" };

  const [current] = await db
    .select({ status: orders.status })
    .from(orders)
    .where(eq(orders.id, params.orderId))
    .limit(1);
  if (!current) return { ok: false, code: "NOT_FOUND" };
  if (!isEditableByAdmin(current.status)) return { ok: false, code: "NOT_EDITABLE" };

  const { input } = params;
  const { now, phone, result } = await prepareDraft(db, input, params);
  if (!result.ok) return { ok: false, code: "INVALID_ORDER", errors: result.errors };
  const draft = result.draft;

  return db.transaction(async (tx): Promise<SaveOrderResult> => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, params.orderId))
      .for("update")
      .limit(1);
    if (!order) return { ok: false, code: "NOT_FOUND" };
    // Puede haberse confirmado mientras se editaba.
    if (!isEditableByAdmin(order.status)) return { ok: false, code: "NOT_EDITABLE" };

    const before = await snapshotFromDb(tx, order.id);
    const email = input.customer.email?.trim() || null;
    const customerId =
      phone === order.customerPhone
        ? order.customerId
        : await upsertCustomer(tx, { name: input.customer.name, phone, email });

    await tx
      .update(orders)
      .set({
        customerId,
        customerName: input.customer.name,
        customerPhone: phone,
        customerEmail: email,
        deliveryType: input.deliveryType,
        deliveryAddress: input.deliveryType === "DELIVERY" ? input.address : null,
        deliveryDistanceM: draft.deliveryDistanceM,
        deliveryFeeStatus: draft.deliveryFeeStatus,
        scheduledDate: input.scheduledDate,
        scheduledTimeSlot: input.timeSlot,
        subtotal: numericFromCents(draft.subtotalCents),
        deliveryFee:
          draft.deliveryFeeCents === null ? null : numericFromCents(draft.deliveryFeeCents),
        total: numericFromCents(draft.totalCents),
        updatedAt: now,
      })
      .where(eq(orders.id, order.id));

    await tx.delete(orderItems).where(eq(orderItems.orderId, order.id));
    await insertItems(tx, order.id, draft.items);

    const after = snapshotFromDraft(input, phone, draft);
    const changes = describeEdit(before, after);
    if (changes.length > 0) {
      await logChange(tx, {
        orderId: order.id,
        kind: "EDICION",
        actorId: params.actorId,
        before,
        after,
        note: changes.join("\n"),
        at: now,
      });
    }

    return { ok: true, order: { id: order.id, orderNumber: order.orderNumber }, changes };
  });
}

/**
 * Alta manual: para los pedidos que llegan solo por WhatsApp. Entra en PENDIENTE_CONFIRMACION (la
 * administración ya habló con el cliente), con origen MANUAL y sin aceptación de términos web.
 */
export async function createManualOrder(
  db: AppDb,
  params: { input: AdminOrderInput; actorId: string } & Deps,
): Promise<SaveOrderResult> {
  const { input } = params;
  const { now, phone, result } = await prepareDraft(db, input, params);
  if (!result.ok) return { ok: false, code: "INVALID_ORDER", errors: result.errors };
  const draft = result.draft;

  return db.transaction(async (tx): Promise<SaveOrderResult> => {
    const email = input.customer.email?.trim() || null;
    const customerId = await upsertCustomer(tx, { name: input.customer.name, phone, email });

    const [order] = await tx
      .insert(orders)
      .values({
        origin: "MANUAL",
        status: "PENDIENTE_CONFIRMACION",
        customerId,
        customerName: input.customer.name,
        customerPhone: phone,
        customerEmail: email,
        deliveryType: input.deliveryType,
        deliveryAddress: input.deliveryType === "DELIVERY" ? input.address : null,
        deliveryDistanceM: draft.deliveryDistanceM,
        deliveryFeeStatus: draft.deliveryFeeStatus,
        scheduledDate: input.scheduledDate,
        scheduledTimeSlot: input.timeSlot,
        subtotal: numericFromCents(draft.subtotalCents),
        deliveryFee:
          draft.deliveryFeeCents === null ? null : numericFromCents(draft.deliveryFeeCents),
        total: numericFromCents(draft.totalCents),
        paymentMethod: input.paymentMethod ?? "PENDIENTE",
        createdAt: now,
        updatedAt: now,
      })
      .returning({ id: orders.id, orderNumber: orders.orderNumber });

    await insertItems(tx, order!.id, draft.items);
    await logChange(tx, {
      orderId: order!.id,
      kind: "ESTADO",
      actorId: params.actorId,
      after: { status: "PENDIENTE_CONFIRMACION" },
      note: "Pedido cargado manualmente",
      at: now,
    });

    return { ok: true, order: order!, changes: [] };
  });
}
