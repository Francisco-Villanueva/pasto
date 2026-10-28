import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { loadCatalogFromDb } from "@/db/catalog";
import { seedDatabase } from "@/db/seed";
import { settings } from "@/db/schema";
import type { AppDb } from "@/db/types";

/** Instante de referencia de los tests: un miércoles. El próximo día abierto es el 04/11/2026. */
export const TEST_NOW = new Date("2026-10-28T10:00:00-03:00");

/** Postgres en memoria con migraciones, catálogo de ejemplo, agenda y los ajustes de un local configurado. */
export async function createTestDb(): Promise<AppDb> {
  const db = drizzle(new PGlite());
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await seedDatabase(db, TEST_NOW);
  await db.insert(settings).values([
    { key: "pasto_whatsapp", value: "+5492915550000" },
    { key: "store_location", value: { lat: -38.7183, lng: -62.2663 } },
  ]);
  return db as unknown as AppDb;
}

/** Ids reales (UUID) de los productos de ejemplo, por SKU. */
export async function productIds(db: AppDb): Promise<(sku: string) => string> {
  const catalog = await loadCatalogFromDb(db);
  return (sku) => {
    const product = catalog.products.find((p) => p.sku === sku);
    if (!product) throw new Error(`Producto de ejemplo inexistente: ${sku}`);
    return product.id;
  };
}
