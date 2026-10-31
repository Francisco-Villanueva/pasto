import { and, count, eq, gt } from "drizzle-orm";
import { loadSettingsFromDb } from "@/db/catalog";
import { orders } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { numericFromCents } from "@/domain/money";
import { buildOrderDraft, type DraftError, type OrderDraft } from "@/domain/order-draft";
import { normalizeArPhone } from "@/domain/phone";
import { parseStoreSettings, type StoreSettings } from "@/domain/settings";
import { buildOrderMessage, buildWhatsappUrl } from "@/domain/whatsapp";
import type { CheckoutInput } from "@/lib/checkout-schema";
import { loadDraftContext } from "./draft-context";
import { insertItems, logChange, upsertCustomer, type Tx } from "./order-store";
import { toWhatsappOrder } from "./order-view";

/** Pedidos preliminares por teléfono en la última hora. Se cuenta en la base, así que vale para todas las instancias. */
export const MAX_ORDERS_PER_PHONE_PER_HOUR = 5;

export type CreateOrderDeps = {
  now?: Date;
  /** Distancia por calle al local para un lugar de Google. Nula si no se pudo medir. */
  distanceFor?: (placeId: string, settings: StoreSettings) => Promise<number | null>;
};

export type CreateOrderResult =
  | {
      ok: true;
      order: { id: string; orderNumber: string; accessToken: string };
      message: string;
      whatsappUrl: string;
    }
  | { ok: false; code: "CHECKOUT_DISABLED" | "RATE_LIMITED" }
  | { ok: false; code: "INVALID_ORDER"; errors: DraftError[] };

/**
 * Crea el pedido PRELIMINAR. El navegador solo manda qué quiere pedir; acá se vuelve a validar y
 * a calcular todo (precios, envío, día y horario) con los datos vigentes. Se guarda completo o no se guarda.
 */
export async function createPreliminaryOrder(
  db: AppDb,
  input: CheckoutInput,
  deps: CreateOrderDeps = {},
): Promise<CreateOrderResult> {
  const now = deps.now ?? new Date();

  const settings = parseStoreSettings(await loadSettingsFromDb(db));
  if (!settings.whatsapp) return { ok: false, code: "CHECKOUT_DISABLED" };

  const phone = normalizeArPhone(input.customer.phone)!;
  const [recent] = await db
    .select({ total: count() })
    .from(orders)
    .where(
      and(
        eq(orders.customerPhone, phone),
        gt(orders.createdAt, new Date(now.getTime() - 3_600_000)),
      ),
    );
  if ((recent?.total ?? 0) >= MAX_ORDERS_PER_PHONE_PER_HOUR) {
    return { ok: false, code: "RATE_LIMITED" };
  }

  const result = buildOrderDraft(
    {
      cart: input.cart,
      deliveryType: input.deliveryType,
      hasAddress: Boolean(input.address),
      scheduledDate: input.scheduledDate,
      timeSlot: input.timeSlot,
    },
    await loadDraftContext(db, settings, {
      scheduledDate: input.scheduledDate,
      deliveryType: input.deliveryType,
      placeId: input.placeId,
      now,
      distanceFor: deps.distanceFor,
    }),
  );
  if (!result.ok) return { ok: false, code: "INVALID_ORDER", errors: result.errors };

  const saved = await db.transaction((tx) => saveOrder(tx, input, phone, result.draft, now));

  const message = buildOrderMessage(
    toWhatsappOrder(
      {
        orderNumber: saved.orderNumber,
        deliveryType: input.deliveryType,
        deliveryAddress: input.deliveryType === "DELIVERY" ? (input.address ?? null) : null,
        scheduledDate: input.scheduledDate,
        scheduledTimeSlot: input.timeSlot,
        subtotal: numericFromCents(result.draft.subtotalCents),
        deliveryFee:
          result.draft.deliveryFeeCents === null
            ? null
            : numericFromCents(result.draft.deliveryFeeCents),
        customerName: input.customer.name,
        customerPhone: phone,
      },
      result.draft.items.map((item) => ({
        category: item.category,
        tierSize: item.tierSize,
        details: item.details,
      })),
    ),
  );

  return {
    ok: true,
    order: saved,
    message,
    whatsappUrl: buildWhatsappUrl(settings.whatsapp, message),
  };
}

async function saveOrder(
  tx: Tx,
  input: CheckoutInput,
  phone: string,
  draft: OrderDraft,
  now: Date,
) {
  const email = input.customer.email?.trim() || null;

  // Un cliente por teléfono: guarda el consentimiento comercial más reciente.
  const customerId = await upsertCustomer(tx, {
    name: input.customer.name,
    phone,
    email,
    consentCommercial: input.consentCommercial,
  });

  const [order] = await tx
    .insert(orders)
    .values({
      origin: "WEB",
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
      termsAcceptedAt: now,
      // Misma hora con la que se validó el pedido (corte, límite por teléfono, abandono).
      createdAt: now,
      updatedAt: now,
    })
    .returning({
      id: orders.id,
      orderNumber: orders.orderNumber,
      accessToken: orders.accessToken,
    });

  await insertItems(tx, order!.id, draft.items);
  await logChange(tx, {
    orderId: order!.id,
    kind: "ESTADO",
    actorId: null,
    after: { status: "PRELIMINAR" },
    note: "Pedido creado desde la web",
    at: now,
  });

  return order!;
}
