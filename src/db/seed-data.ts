import { numericFromCents } from "../domain/money";
import { SAMPLE_PRODUCTS, SAMPLE_SHIPPING, SAMPLE_TIERS } from "../domain/sample-catalog";
import { generateDeliveryDays } from "../domain/schedule";
import { DEFAULT_ABANDON_AFTER_HOURS } from "../domain/orders";

/** Franjas de ejemplo: se reemplazan por las reales desde /admin/agenda. */
export const DEFAULT_SLOTS = ["12:00 a 14:00", "18:00 a 20:00"];

/**
 * Ajustes iniciales. Los que todavía no se conocen NO se siembran: si falta la clave, la app los
 * toma como "sin configurar" y no habilita el checkout. Son `pasto_whatsapp`, `fudo_url`,
 * `store_address` y `store_location` (coordenadas del local).
 * `abandon_after_hours` en 0 desactiva la cancelación por abandono.
 */
export const SETTING_DEFAULTS: Record<string, unknown> = {
  delivery_max_distance_m: SAMPLE_SHIPPING.maxDistanceM,
  abandon_after_hours: DEFAULT_ABANDON_AFTER_HOURS,
  default_slots: DEFAULT_SLOTS,
};

export function buildSeedRows(now: Date) {
  return {
    products: SAMPLE_PRODUCTS.map((p) => ({
      sku: p.sku,
      name: p.name,
      category: p.category,
      description: "",
      ingredients: "A completar",
      allergens: "A completar",
      netWeightG: p.netWeightG,
      macros: p.macros,
      price: p.priceCents === undefined ? null : numericFromCents(p.priceCents),
    })),
    packPricingTiers: SAMPLE_TIERS.map((t) => ({
      category: t.category,
      size: t.size,
      price: numericFromCents(t.priceCents),
    })),
    shippingTiers: SAMPLE_SHIPPING.tiers.map((t) => ({
      upToM: t.upToM,
      fee: numericFromCents(t.feeCents),
    })),
    settings: Object.entries(SETTING_DEFAULTS).map(([key, value]) => ({ key, value })),
    deliveryDays: generateDeliveryDays(now, { weeks: 6, defaultSlots: DEFAULT_SLOTS }).map((d) => ({
      date: d.date,
      isOpen: d.isOpen,
      cutoffAt: d.cutoffAt,
      slots: [...d.slots],
    })),
  };
}
