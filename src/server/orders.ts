import { and, count, eq, gt } from "drizzle-orm";
import {
  customers,
  deliveryDays,
  orderChanges,
  orderItemDetails,
  orderItems,
  orders,
  shippingTiers,
} from "@/db/schema";
import { loadCatalogFromDb, loadSettingsFromDb } from "@/db/catalog";
import type { AppDb } from "@/db/types";
import { centsFromNumeric, numericFromCents } from "@/domain/money";
import { buildOrderDraft, type DraftError, type OrderDraft } from "@/domain/order-draft";
import { normalizeArPhone } from "@/domain/phone";
import type { DeliveryDayConfig } from "@/domain/schedule";
import { parseStoreSettings, type StoreSettings } from "@/domain/settings";
import { toDomainCatalog, toPriceTable } from "@/domain/store-catalog";
import { buildOrderMessage, buildWhatsappUrl } from "@/domain/whatsapp";
import type { CheckoutInput } from "@/lib/checkout-schema";
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

type Tx = Parameters<Parameters<AppDb["transaction"]>[0]>[0];

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

  const [catalog, dayRows, tierRows] = await Promise.all([
    loadCatalogFromDb(db),
    db.select().from(deliveryDays).where(eq(deliveryDays.date, input.scheduledDate)),
    db.select().from(shippingTiers),
  ]);

  const days: DeliveryDayConfig[] = dayRows.map((d) => ({
    date: d.date,
    isOpen: d.isOpen,
    cutoffAt: d.cutoffAt,
    slots: d.slots,
  }));

  const distanceM =
    input.deliveryType === "DELIVERY" && input.placeId && deps.distanceFor
      ? await deps.distanceFor(input.placeId, settings)
      : null;

  const result = buildOrderDraft(
    {
      cart: input.cart,
      deliveryType: input.deliveryType,
      hasAddress: Boolean(input.address),
      scheduledDate: input.scheduledDate,
      timeSlot: input.timeSlot,
    },
    {
      catalog: toDomainCatalog(catalog),
      prices: toPriceTable(catalog),
      days,
      now,
      shipping: {
        maxDistanceM: settings.maxDistanceM,
        tiers: tierRows.map((t) => ({ upToM: t.upToM, feeCents: centsFromNumeric(t.fee) })),
      },
      distanceM,
    },
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
  const [existing] = await tx.select().from(customers).where(eq(customers.phone, phone)).limit(1);
  let customerId = existing?.id;
  if (existing) {
    await tx
      .update(customers)
      .set({
        fullName: input.customer.name,
        email: email ?? existing.email,
        consentCommercial: input.consentCommercial,
      })
      .where(eq(customers.id, existing.id));
  } else {
    const [created] = await tx
      .insert(customers)
      .values({
        fullName: input.customer.name,
        phone,
        email,
        consentCommercial: input.consentCommercial,
      })
      .returning({ id: customers.id });
    customerId = created!.id;
  }

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

  for (const item of draft.items) {
    const [row] = await tx
      .insert(orderItems)
      .values({
        orderId: order!.id,
        itemType: item.itemType,
        tierSize: item.tierSize,
        category: item.category,
        unitPrice: numericFromCents(item.unitPriceCents),
        totalPrice: numericFromCents(item.totalPriceCents),
      })
      .returning({ id: orderItems.id });

    await tx.insert(orderItemDetails).values(
      item.details.map((detail) => ({
        orderItemId: row!.id,
        productId: detail.productId,
        productName: detail.productName,
        recipeVersion: detail.recipeVersion,
        quantity: detail.quantity,
      })),
    );
  }

  await tx.insert(orderChanges).values({
    orderId: order!.id,
    kind: "ESTADO",
    after: { status: "PRELIMINAR" },
    note: "Pedido creado desde la web",
  });

  return order!;
}
