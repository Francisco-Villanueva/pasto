import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { centsFromNumeric } from "../domain/money";
import { sampleStoreCatalog, type StoreCatalog } from "../domain/store-catalog";
import { getDb, hasDatabase } from "./index";
import { packPricingTiers, products, settings } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = PgDatabase<PgQueryResultHKT, any>;

/** Catálogo completo (incluye platos inactivos, para poder avisar en carritos viejos). */
export async function loadCatalogFromDb(db: AnyDb): Promise<StoreCatalog> {
  const [productRows, tierRows] = await Promise.all([
    db.select().from(products).orderBy(products.category, products.name),
    db.select().from(packPricingTiers),
  ]);

  return {
    products: productRows.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      description: p.description,
      ingredients: p.ingredients,
      allergens: p.allergens,
      netWeightG: p.netWeightG,
      macros: p.macros,
      imageUrl: p.imageUrl,
      isActive: p.isActive,
      recipeVersion: p.recipeVersion,
      priceCents: p.price === null ? undefined : centsFromNumeric(p.price),
    })),
    tiers: tierRows
      .filter((t) => t.category !== "COMPLEMENTO")
      .map((t) => ({
        category: t.category as "ESENCIAL" | "PROTEICO" | "BURRITO",
        size: t.size,
        priceCents: centsFromNumeric(t.price),
      })),
  };
}

export async function loadSettingsFromDb(db: AnyDb): Promise<Record<string, unknown>> {
  const rows = await db.select().from(settings);
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

/**
 * Catálogo para la tienda. Lee de la base (Neon, o la base en memoria de desarrollo) y, si no hay ninguna, usa el catálogo de ejemplo.
 */
export async function loadStoreCatalog(): Promise<StoreCatalog> {
  if (!hasDatabase()) return sampleStoreCatalog();
  return loadCatalogFromDb(await getDb());
}

/** Ajustes globales. Sin base de datos devuelve vacío: lo no configurado no se muestra. */
export async function loadStoreSettings(): Promise<Record<string, unknown>> {
  if (!hasDatabase()) return {};
  return loadSettingsFromDb(await getDb());
}
