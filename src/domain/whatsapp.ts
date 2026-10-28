import type { PackCategory } from "./catalog";
import { formatMoney, type Cents } from "./money";

export type WhatsappOrder = {
  orderNumber: string;
  items: readonly {
    category: PackCategory;
    tierSize: number;
    details: readonly { quantity: number; productName: string }[];
  }[];
  complements: readonly { quantity: number; productName: string }[];
  /** Ej. "Miércoles 04/11". */
  deliveryDayLabel: string;
  timeSlot: string;
  deliveryType: "DELIVERY" | "RETIRO";
  address?: {
    street: string;
    number: string;
    floorApt?: string;
    neighborhood: string;
    notes?: string;
  };
  subtotalCents: Cents;
  /** Nulo cuando el envío queda a confirmar por WhatsApp. */
  deliveryFeeCents: Cents | null;
  customerName: string;
  customerPhone: string;
};

const CATEGORY_LABEL: Record<PackCategory, string> = {
  ESENCIAL: "Esencial",
  PROTEICO: "Proteico",
  BURRITO: "Burritos",
};

/** Por encima de esta longitud (ya codificado) se manda un resumen: el detalle está en el sistema. */
export const MAX_ENCODED_LENGTH = 1800;

function deliveryLine(order: WhatsappOrder): string {
  const type = order.deliveryType === "DELIVERY" ? "Envío" : "Retiro";
  return `Entrega: ${order.deliveryDayLabel} - ${order.timeSlot} (${type})`;
}

function addressLine(order: WhatsappOrder): string | null {
  if (order.deliveryType !== "DELIVERY" || !order.address) return null;
  const { street, number, floorApt, neighborhood, notes } = order.address;
  const door = [street, number, floorApt].filter(Boolean).join(" ");
  return `Dirección: ${door}, ${neighborhood}${notes ? ` (Ref: ${notes})` : ""}`;
}

function totalsLines(order: WhatsappOrder): string[] {
  if (order.deliveryFeeCents === null) {
    return [
      `Subtotal: ${formatMoney(order.subtotalCents)}`,
      "Envío: a confirmar",
      `Total: ${formatMoney(order.subtotalCents)} + envío a confirmar`,
    ];
  }
  return [
    `Subtotal: ${formatMoney(order.subtotalCents)}`,
    `Envío: ${formatMoney(order.deliveryFeeCents)}`,
    `Total: ${formatMoney(order.subtotalCents + order.deliveryFeeCents)}`,
  ];
}

const CLOSING = "Entiendo que el pedido queda sujeto a confirmación de Pasto.";

function buildFull(order: WhatsappOrder): string {
  const itemLines = order.items.map(
    (item) =>
      `- ${CATEGORY_LABEL[item.category]} x${item.tierSize}: ${item.details
        .map((d) => `${d.quantity}x ${d.productName}`)
        .join(", ")}`,
  );
  const complementLines = order.complements.map(
    (c) => `- Complemento: ${c.quantity}x ${c.productName}`,
  );
  const address = addressLine(order);

  return [
    `Hola, Pasto. Quiero solicitar el pedido ${order.orderNumber}.`,
    "",
    ...itemLines,
    ...complementLines,
    "",
    deliveryLine(order),
    ...(address ? [address] : []),
    "",
    ...totalsLines(order),
    "",
    `Cliente: ${order.customerName}`,
    `Teléfono: ${order.customerPhone}`,
    "",
    CLOSING,
  ].join("\n");
}

function buildSummary(order: WhatsappOrder): string {
  const packs = order.items.length;
  const complements = order.complements.length;
  const address = addressLine(order);

  return [
    `Hola, Pasto. Quiero solicitar el pedido ${order.orderNumber}.`,
    "",
    `Son ${packs} ${packs === 1 ? "pack" : "packs"}${
      complements ? ` y ${complements} ${complements === 1 ? "complemento" : "complementos"}` : ""
    }. El detalle completo ya está cargado con ese número de pedido.`,
    "",
    deliveryLine(order),
    ...(address ? [address] : []),
    "",
    ...totalsLines(order),
    "",
    `Cliente: ${order.customerName}`,
    `Teléfono: ${order.customerPhone}`,
    "",
    CLOSING,
  ].join("\n");
}

/** Mensaje del pedido; si codificado supera el límite, se acorta a un resumen. */
export function buildOrderMessage(
  order: WhatsappOrder,
  maxEncodedLength = MAX_ENCODED_LENGTH,
): string {
  const full = buildFull(order);
  return encodeURIComponent(full).length <= maxEncodedLength ? full : buildSummary(order);
}

/** `wa.me` pide el teléfono solo con dígitos, con código de país y sin "+". */
export function buildWhatsappUrl(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
