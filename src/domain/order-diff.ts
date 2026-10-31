import type { PackCategory, ProductCategory } from "./catalog";
import { formatMoney, type Cents } from "./money";
import { formatDeliveryDay } from "./schedule";

/** Foto de lo editable de un pedido, para registrar qué cambió en cada edición. */
export type OrderSnapshot = {
  scheduledDate: string;
  timeSlot: string;
  deliveryType: "DELIVERY" | "RETIRO";
  address: string | null;
  /** Un texto por pack o complemento, ver `itemLabels`. */
  items: string[];
  subtotalCents: Cents;
  /** Nulo = envío a confirmar. */
  deliveryFeeCents: Cents | null;
  totalCents: Cents;
  customerName: string;
  customerPhone: string;
};

const CATEGORY_LABEL: Record<PackCategory, string> = {
  ESENCIAL: "Esencial",
  PROTEICO: "Proteico",
  BURRITO: "Burritos",
};

const CATEGORY_ORDER: Record<ProductCategory, number> = {
  ESENCIAL: 0,
  PROTEICO: 1,
  BURRITO: 2,
  COMPLEMENTO: 3,
};

/**
 * "Esencial x10: 6x Milanesa…, 4x Guiso…" para un pack; "1x Pollo preparado" para un complemento.
 * El orden es siempre el mismo (packs por categoría y tamaño, complementos al final; platos por
 * nombre), venga el pedido de la base o del formulario: así una edición sin cambios no se ve como cambio.
 */
export function itemLabels(
  items: readonly {
    category: ProductCategory;
    tierSize: number | null;
    details: readonly { quantity: number; productName: string }[];
  }[],
): string[] {
  return [...items]
    .sort(
      (a, b) =>
        CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] ||
        (a.tierSize ?? 0) - (b.tierSize ?? 0) ||
        (a.details[0]?.productName ?? "").localeCompare(b.details[0]?.productName ?? "", "es"),
    )
    .map((item) => {
      const details = [...item.details]
        .sort((a, b) => a.productName.localeCompare(b.productName, "es"))
        .map((d) => `${d.quantity}x ${d.productName}`)
        .join(", ");
      return item.category === "COMPLEMENTO"
        ? details
        : `${CATEGORY_LABEL[item.category]} x${item.tierSize}: ${details}`;
    });
}

export function formatAddress(
  address: {
    street: string;
    number: string;
    floorApt?: string;
    neighborhood: string;
    notes?: string;
  } | null,
): string | null {
  if (!address) return null;
  const door = [address.street, address.number, address.floorApt].filter(Boolean).join(" ");
  return `${door}, ${address.neighborhood}${address.notes ? ` (Ref: ${address.notes})` : ""}`;
}

const fee = (cents: Cents | null) => (cents === null ? "a confirmar" : formatMoney(cents));
const delivery = (type: "DELIVERY" | "RETIRO") => (type === "DELIVERY" ? "Envío" : "Retiro");

/** Qué cambió entre dos fotos del pedido, una línea por campo, en español. Vacío si no cambió nada. */
export function describeEdit(before: OrderSnapshot, after: OrderSnapshot): string[] {
  const lines: string[] = [];

  if (before.items.join("|") !== after.items.join("|")) {
    lines.push(`Contenido: ${before.items.join("; ")} → ${after.items.join("; ")}`);
  }
  if (before.scheduledDate !== after.scheduledDate) {
    lines.push(
      `Día: ${formatDeliveryDay(before.scheduledDate)} → ${formatDeliveryDay(after.scheduledDate)}`,
    );
  }
  if (before.timeSlot !== after.timeSlot)
    lines.push(`Franja: ${before.timeSlot} → ${after.timeSlot}`);
  if (before.deliveryType !== after.deliveryType) {
    lines.push(`Entrega: ${delivery(before.deliveryType)} → ${delivery(after.deliveryType)}`);
  }
  if (before.address !== after.address) {
    lines.push(
      `Dirección: ${before.address ?? "sin dirección"} → ${after.address ?? "sin dirección"}`,
    );
  }
  if (before.customerName !== after.customerName) {
    lines.push(`Cliente: ${before.customerName} → ${after.customerName}`);
  }
  if (before.customerPhone !== after.customerPhone) {
    lines.push(`Teléfono: ${before.customerPhone} → ${after.customerPhone}`);
  }
  if (before.deliveryFeeCents !== after.deliveryFeeCents) {
    lines.push(`Envío: ${fee(before.deliveryFeeCents)} → ${fee(after.deliveryFeeCents)}`);
  }
  if (before.totalCents !== after.totalCents) {
    lines.push(`Total: ${formatMoney(before.totalCents)} → ${formatMoney(after.totalCents)}`);
  }
  return lines;
}
