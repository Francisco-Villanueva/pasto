import { eq } from "drizzle-orm";
import { orderItemDetails, orderItems, orders, type DeliveryAddress } from "@/db/schema";
import { loadSettingsFromDb } from "@/db/catalog";
import type { AppDb } from "@/db/types";
import { centsFromNumeric } from "@/domain/money";
import { formatDeliveryDay } from "@/domain/schedule";
import { parseStoreSettings } from "@/domain/settings";
import { buildOrderMessage, buildWhatsappUrl, type WhatsappOrder } from "@/domain/whatsapp";
import type { PackCategory, ProductCategory } from "@/domain/catalog";

type OrderRow = {
  orderNumber: string;
  deliveryType: "DELIVERY" | "RETIRO";
  deliveryAddress: DeliveryAddress | null;
  scheduledDate: string;
  scheduledTimeSlot: string;
  /** NUMERIC(10,2) como texto. */
  subtotal: string;
  deliveryFee: string | null;
  customerName: string;
  customerPhone: string;
};

type ItemRow = {
  category: ProductCategory;
  tierSize: number | null;
  details: readonly { productName: string; quantity: number }[];
};

/** Arma los datos del mensaje de WhatsApp a partir de un pedido (recién creado o leído de la base). */
export function toWhatsappOrder(order: OrderRow, items: readonly ItemRow[]): WhatsappOrder {
  return {
    orderNumber: order.orderNumber,
    items: items
      .filter((item) => item.category !== "COMPLEMENTO")
      .map((item) => ({
        category: item.category as PackCategory,
        tierSize: item.tierSize ?? 0,
        details: item.details.map((d) => ({ quantity: d.quantity, productName: d.productName })),
      })),
    complements: items
      .filter((item) => item.category === "COMPLEMENTO")
      .flatMap((item) =>
        item.details.map((d) => ({ quantity: d.quantity, productName: d.productName })),
      ),
    deliveryDayLabel: formatDeliveryDay(order.scheduledDate),
    timeSlot: order.scheduledTimeSlot,
    deliveryType: order.deliveryType,
    address: order.deliveryAddress ?? undefined,
    subtotalCents: centsFromNumeric(order.subtotal),
    deliveryFeeCents: order.deliveryFee === null ? null : centsFromNumeric(order.deliveryFee),
    customerName: order.customerName,
    customerPhone: order.customerPhone,
  };
}

export type OrderConfirmation = {
  orderNumber: string;
  status: string;
  deliveryType: "DELIVERY" | "RETIRO";
  deliveryDayLabel: string;
  timeSlot: string;
  subtotalCents: number;
  deliveryFeeCents: number | null;
  totalCents: number;
  lines: string[];
  message: string;
  whatsappUrl: string | null;
};

/**
 * Datos de la página "Pedido enviado". Se busca por el token privado, nunca por el número de pedido
 * (que es adivinable), porque la página muestra datos del cliente.
 */
export async function getOrderConfirmation(
  db: AppDb,
  accessToken: string,
): Promise<OrderConfirmation | null> {
  if (!/^[0-9a-f-]{36}$/i.test(accessToken)) return null;

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.accessToken, accessToken))
    .limit(1);
  if (!order) return null;

  const itemRows = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const items: ItemRow[] = [];
  for (const item of itemRows) {
    const details = await db
      .select()
      .from(orderItemDetails)
      .where(eq(orderItemDetails.orderItemId, item.id));
    items.push({ category: item.category, tierSize: item.tierSize, details });
  }

  const whatsapp = toWhatsappOrder(order, items);
  const message = buildOrderMessage(whatsapp);
  const phone = parseStoreSettings(await loadSettingsFromDb(db)).whatsapp;

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    deliveryType: order.deliveryType,
    deliveryDayLabel: whatsapp.deliveryDayLabel,
    timeSlot: order.scheduledTimeSlot,
    subtotalCents: whatsapp.subtotalCents,
    deliveryFeeCents: whatsapp.deliveryFeeCents,
    totalCents: whatsapp.subtotalCents + (whatsapp.deliveryFeeCents ?? 0),
    lines: [
      ...whatsapp.items.map((item) => `${categoryLabel(item.category)} x${item.tierSize}`),
      ...whatsapp.complements.map((c) => `${c.quantity}x ${c.productName}`),
    ],
    message,
    whatsappUrl: phone ? buildWhatsappUrl(phone, message) : null,
  };
}

function categoryLabel(category: PackCategory): string {
  return { ESENCIAL: "Esencial", PROTEICO: "Proteico", BURRITO: "Burritos" }[category];
}
