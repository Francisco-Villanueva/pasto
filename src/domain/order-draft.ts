import { cartIssues, type Cart, type CartIssue } from "./cart";
import type { Catalog, ProductCategory } from "./catalog";
import type { Cents } from "./money";
import { priceCart } from "./pricing";
import { isDayAvailable, localDate, type DeliveryDayConfig } from "./schedule";
import { computeDeliveryFee, type DeliveryFee, type ShippingConfig } from "./shipping";

export type DraftDetail = {
  productId: string;
  productName: string;
  recipeVersion: string;
  quantity: number;
};

export type DraftItem = {
  itemType: "PACK" | "BURRITO_PACK" | "COMPLEMENTO";
  /** Nulo en complementos. */
  tierSize: number | null;
  category: ProductCategory;
  unitPriceCents: Cents;
  totalPriceCents: Cents;
  details: DraftDetail[];
};

export type OrderDraft = {
  items: DraftItem[];
  subtotalCents: Cents;
  /** Nulo mientras el envío está "a confirmar". */
  deliveryFeeCents: Cents | null;
  deliveryFeeStatus: "NO_APLICA" | "CALCULADO" | "A_CONFIRMAR";
  deliveryDistanceM: number | null;
  totalCents: Cents;
};

export type DraftError =
  | { code: "CART_INVALID"; issues: CartIssue[] }
  | { code: "PRICE_MISSING"; keys: string[] }
  | { code: "DAY_UNAVAILABLE" }
  | { code: "SLOT_INVALID" }
  | { code: "ADDRESS_REQUIRED" }
  | { code: "OUT_OF_RANGE" };

export type DraftInput = {
  cart: Cart;
  deliveryType: "DELIVERY" | "RETIRO";
  hasAddress: boolean;
  scheduledDate: string;
  timeSlot: string;
  /**
   * Costo de envío fijado a mano por la administración (por ejemplo, acordado por WhatsApp).
   * Reemplaza al cálculo por distancia y no se rechaza por estar fuera del radio. Solo vale en envíos.
   */
  deliveryFeeOverrideCents?: Cents | null;
};

export type DraftContext = {
  catalog: Catalog;
  prices: ReadonlyMap<string, Cents>;
  /** Días de la agenda (los que existen en la base). */
  days: readonly DeliveryDayConfig[];
  now: Date;
  shipping: ShippingConfig;
  /** Distancia por calle al local, medida por el servidor. Nula si no se pudo ubicar. */
  distanceM: number | null;
  /**
   * Pedido cargado o editado por la administración: puede ir a un día de la agenda aunque ya haya
   * pasado el corte o esté cerrado (siempre que sea hoy o futuro). El cliente nunca tiene esta opción.
   */
  adminOverride?: boolean;
};

export type DraftResult = { ok: true; draft: OrderDraft } | { ok: false; errors: DraftError[] };

/**
 * Arma el pedido a partir de lo que mandó el cliente, recalculando TODO con el catálogo, los precios,
 * la agenda y los tramos de envío vigentes. Es la única fuente de importes, día y horario válidos.
 * No toca la base: el servicio de pedidos solo guarda el resultado.
 */
export function buildOrderDraft(input: DraftInput, ctx: DraftContext): DraftResult {
  const errors: DraftError[] = [];

  const issues = cartIssues(input.cart, ctx.catalog);
  if (issues.length > 0) errors.push({ code: "CART_INVALID", issues });

  const priced = priceCart(input.cart, ctx.prices, ctx.catalog);
  if (!priced.ok && issues.length === 0) {
    errors.push({ code: "PRICE_MISSING", keys: priced.missingPrices });
  }

  // Día y franja: tienen que estar abiertos en la agenda y antes del corte, a la hora de enviarlo.
  const day = ctx.days.find((d) => d.date === input.scheduledDate);
  const dayOk = day
    ? ctx.adminOverride
      ? day.date >= localDate(ctx.now)
      : isDayAvailable(day, ctx.now)
    : false;
  if (!day || !dayOk) errors.push({ code: "DAY_UNAVAILABLE" });
  else if (!day.slots.includes(input.timeSlot)) errors.push({ code: "SLOT_INVALID" });

  if (input.deliveryType === "DELIVERY" && !input.hasAddress)
    errors.push({ code: "ADDRESS_REQUIRED" });

  const manualFee =
    input.deliveryType === "DELIVERY" &&
    input.deliveryFeeOverrideCents !== undefined &&
    input.deliveryFeeOverrideCents !== null;
  const fee: DeliveryFee = manualFee
    ? { status: "CALCULATED", feeCents: input.deliveryFeeOverrideCents!, tierUpToM: 0 }
    : computeDeliveryFee(
        { deliveryType: input.deliveryType, distanceM: ctx.distanceM },
        ctx.shipping,
      );
  if (fee.status === "OUT_OF_RANGE") errors.push({ code: "OUT_OF_RANGE" });

  if (errors.length > 0 || !priced.ok) return { ok: false, errors };

  const items: DraftItem[] = [];
  for (const line of priced.lines) {
    if (line.kind === "PACK") {
      const pack = input.cart.packs.find((p) => p.id === line.packId)!;
      items.push({
        itemType: line.category === "BURRITO" ? "BURRITO_PACK" : "PACK",
        tierSize: line.size,
        category: line.category,
        unitPriceCents: line.unitPriceCents,
        totalPriceCents: line.totalCents,
        details: pack.items.map((item) => detailFor(ctx.catalog, item.productId, item.quantity)),
      });
    } else {
      items.push({
        itemType: "COMPLEMENTO",
        tierSize: null,
        category: "COMPLEMENTO",
        unitPriceCents: line.unitPriceCents,
        totalPriceCents: line.totalCents,
        details: [detailFor(ctx.catalog, line.productId, line.quantity)],
      });
    }
  }

  const deliveryFeeCents = fee.feeCents;
  return {
    ok: true,
    draft: {
      items,
      subtotalCents: priced.subtotalCents,
      deliveryFeeCents,
      deliveryFeeStatus:
        fee.status === "PICKUP"
          ? "NO_APLICA"
          : fee.status === "CALCULATED"
            ? "CALCULADO"
            : "A_CONFIRMAR",
      deliveryDistanceM: input.deliveryType === "DELIVERY" && !manualFee ? ctx.distanceM : null,
      totalCents: priced.subtotalCents + (deliveryFeeCents ?? 0),
    },
  };
}

function detailFor(catalog: Catalog, productId: string, quantity: number): DraftDetail {
  const product = catalog.get(productId)!;
  return {
    productId,
    productName: product.name,
    recipeVersion: product.recipeVersion ?? "v1.0",
    quantity,
  };
}
