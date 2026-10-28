import { tierKey, type Catalog, type PackCategory, type PriceTable } from "./catalog";
import type { Cart } from "./cart";
import type { Cents } from "./money";

export type PricedLine =
  | {
      kind: "PACK";
      packId: string;
      category: PackCategory;
      size: number;
      unitPriceCents: Cents;
      totalCents: Cents;
    }
  | {
      kind: "COMPLEMENTO";
      productId: string;
      quantity: number;
      unitPriceCents: Cents;
      totalCents: Cents;
    };

export type PricingResult =
  { ok: true; lines: PricedLine[]; subtotalCents: Cents } | { ok: false; missingPrices: string[] };

/**
 * Cada pack se cobra a su propio precio: dos packs de 10 NO pasan a precio de pack de 20.
 * No hay descuentos por volumen.
 */
export function priceCart(cart: Cart, prices: PriceTable, catalog: Catalog): PricingResult {
  const lines: PricedLine[] = [];
  const missing: string[] = [];

  for (const pack of cart.packs) {
    const key = tierKey(pack.category, pack.size);
    const price = prices.get(key);
    if (price === undefined) {
      missing.push(key);
      continue;
    }
    lines.push({
      kind: "PACK",
      packId: pack.id,
      category: pack.category,
      size: pack.size,
      unitPriceCents: price,
      totalCents: price,
    });
  }

  for (const complement of cart.complements) {
    const price = catalog.get(complement.productId)?.priceCents;
    if (price === undefined) {
      missing.push(`COMPLEMENTO:${complement.productId}`);
      continue;
    }
    lines.push({
      kind: "COMPLEMENTO",
      productId: complement.productId,
      quantity: complement.quantity,
      unitPriceCents: price,
      totalCents: price * complement.quantity,
    });
  }

  if (missing.length > 0) return { ok: false, missingPrices: missing };
  const subtotalCents = lines.reduce((sum, line) => sum + line.totalCents, 0);
  return { ok: true, lines, subtotalCents };
}
