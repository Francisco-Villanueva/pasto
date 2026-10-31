import { eq } from "drizzle-orm";
import { loadCatalogFromDb } from "@/db/catalog";
import { deliveryDays, shippingTiers } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { centsFromNumeric } from "@/domain/money";
import type { DraftContext } from "@/domain/order-draft";
import type { DeliveryDayConfig } from "@/domain/schedule";
import type { StoreSettings } from "@/domain/settings";
import { toDomainCatalog, toPriceTable } from "@/domain/store-catalog";

/** Mide la distancia por calle al local para un lugar de Google. Nula si no se pudo medir. */
export type DistanceFor = (placeId: string, settings: StoreSettings) => Promise<number | null>;

/**
 * Reúne todo lo que `buildOrderDraft` necesita para validar y calcular un pedido con los datos
 * vigentes: catálogo y precios, el día pedido de la agenda, los tramos de envío y la distancia.
 */
export async function loadDraftContext(
  db: AppDb,
  settings: StoreSettings,
  options: {
    scheduledDate: string;
    deliveryType: "DELIVERY" | "RETIRO";
    placeId?: string;
    now: Date;
    adminOverride?: boolean;
    distanceFor?: DistanceFor;
  },
): Promise<DraftContext> {
  const [catalog, dayRows, tierRows] = await Promise.all([
    loadCatalogFromDb(db),
    db.select().from(deliveryDays).where(eq(deliveryDays.date, options.scheduledDate)),
    db.select().from(shippingTiers),
  ]);

  const days: DeliveryDayConfig[] = dayRows.map((d) => ({
    date: d.date,
    isOpen: d.isOpen,
    cutoffAt: d.cutoffAt,
    slots: d.slots,
  }));

  const distanceM =
    options.deliveryType === "DELIVERY" && options.placeId && options.distanceFor
      ? await options.distanceFor(options.placeId, settings)
      : null;

  return {
    catalog: toDomainCatalog(catalog),
    prices: toPriceTable(catalog),
    days,
    now: options.now,
    shipping: {
      maxDistanceM: settings.maxDistanceM,
      tiers: tierRows.map((t) => ({ upToM: t.upToM, feeCents: centsFromNumeric(t.fee) })),
    },
    distanceM,
    adminOverride: options.adminOverride,
  };
}
