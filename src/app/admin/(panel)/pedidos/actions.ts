"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { ORDER_STATUSES } from "@/domain/orders";
import { adminOrderSchema } from "@/lib/admin-order-schema";
import { describeDraftErrors } from "@/lib/checkout-errors";
import { fieldErrors } from "@/lib/checkout-schema";
import {
  changeOrderStatus,
  createManualOrder,
  updateOrder,
  updatePayment,
} from "@/server/admin-orders";
import { authorizeAction } from "@/server/auth/dal";
import { drivingDistanceM, mapsOptionsFromEnv } from "@/server/maps";

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; message: string; messages?: string[]; fields?: Record<string, string> };

const uuid = z.string().uuid();

function refresh(orderId?: string) {
  revalidatePath("/admin/pedidos");
  if (orderId) revalidatePath(`/admin/pedidos/${orderId}`);
  revalidatePath("/admin/produccion");
}

const STATUS_ERRORS = {
  NOT_FOUND: "No encontramos el pedido.",
  SAME_STATUS: "El pedido ya está en ese estado.",
  FORBIDDEN_ROLE: "No tenés permiso para hacer ese cambio.",
  INVALID_TRANSITION: "Ese cambio de estado no está permitido desde el estado actual.",
  REASON_REQUIRED: "Escribí el motivo de la cancelación.",
} as const;

/** Cambia el estado de un pedido. Administración puede todo lo que permite la matriz; Cocina, solo producción. */
export async function changeStatusAction(input: {
  orderId: string;
  to: string;
  reason?: string;
}): Promise<ActionResult> {
  const auth = await authorizeAction("ORDERS_MANAGE", "KITCHEN_STATUS");
  if (!auth.ok) return auth;

  const parsed = z
    .object({ orderId: uuid, to: z.enum(ORDER_STATUSES), reason: z.string().max(500).optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Los datos del cambio no son válidos." };

  const result = await changeOrderStatus(await getDb(), {
    ...parsed.data,
    role: auth.user.role,
    actorId: auth.user.id,
  });
  if (!result.ok) return { ok: false, message: STATUS_ERRORS[result.code] };

  refresh(parsed.data.orderId);
  return { ok: true };
}

export async function updatePaymentAction(input: {
  orderId: string;
  method?: string;
  status?: string;
}): Promise<ActionResult> {
  const auth = await authorizeAction("ORDERS_MANAGE");
  if (!auth.ok) return auth;

  const parsed = z
    .object({
      orderId: uuid,
      method: z.enum(["EFECTIVO", "TRANSFERENCIA", "PENDIENTE"]).optional(),
      status: z.enum(["PENDIENTE", "PAGADO"]).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Los datos del pago no son válidos." };

  const result = await updatePayment(await getDb(), { ...parsed.data, actorId: auth.user.id });
  if (!result.ok) {
    return {
      ok: false,
      message:
        result.code === "NOT_FOUND" ? "No encontramos el pedido." : "No hay nada para cambiar.",
    };
  }

  refresh(parsed.data.orderId);
  return { ok: true };
}

/**
 * Guarda un pedido: lo edita si hay `orderId` y, si no, lo crea como alta manual. El navegador no manda
 * precios: el servidor recalcula todo con el catálogo y la agenda vigentes.
 */
export async function saveOrderAction(input: {
  orderId: string | null;
  order: unknown;
}): Promise<ActionResult<{ orderId: string; orderNumber: string; changes: string[] }>> {
  const auth = await authorizeAction("ORDERS_MANAGE");
  if (!auth.ok) return auth;

  const parsed = adminOrderSchema.safeParse(input.order);
  if (!parsed.success) {
    return {
      ok: false,
      message: "Revisá los datos del pedido.",
      fields: fieldErrors(parsed.error),
    };
  }

  const maps = mapsOptionsFromEnv();
  const distanceFor = (
    placeId: string,
    settings: { storeLocation: { lat: number; lng: number } | null },
  ) => drivingDistanceM(placeId, settings.storeLocation, maps);

  const db = await getDb();
  const result = input.orderId
    ? await updateOrder(db, {
        orderId: z.string().uuid().catch("").parse(input.orderId),
        input: parsed.data,
        actorId: auth.user.id,
        distanceFor,
      })
    : await createManualOrder(db, { input: parsed.data, actorId: auth.user.id, distanceFor });

  if (!result.ok) {
    if (result.code === "INVALID_ORDER") {
      const messages = describeDraftErrors(result.errors);
      return { ok: false, message: "El pedido necesita un ajuste.", messages };
    }
    return {
      ok: false,
      message:
        result.code === "NOT_EDITABLE"
          ? "El pedido ya está confirmado y no se puede editar. Volvelo a pendiente si necesitás cambiarlo."
          : "No encontramos el pedido.",
    };
  }

  refresh(result.order.id);
  return {
    ok: true,
    orderId: result.order.id,
    orderNumber: result.order.orderNumber,
    changes: result.changes,
  };
}
