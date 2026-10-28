import type { AppDb } from "@/db/types";
import { shippingTiers } from "@/db/schema";
import { centsFromNumeric } from "@/domain/money";
import type { StoreSettings } from "@/domain/settings";
import type { ShippingConfig } from "@/domain/shipping";

/** Tramos de envío (editables por el admin) y radio máximo, tal como los usa el dominio. */
export async function loadShippingConfig(
  db: AppDb,
  settings: StoreSettings,
): Promise<ShippingConfig> {
  const rows = await db.select().from(shippingTiers);
  return {
    maxDistanceM: settings.maxDistanceM,
    tiers: rows.map((t) => ({ upToM: t.upToM, feeCents: centsFromNumeric(t.fee) })),
  };
}
