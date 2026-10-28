import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { buildSeedRows } from "./seed-data";
import { deliveryDays, packPricingTiers, products, settings, shippingTiers } from "./schema";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyDb = PgDatabase<PgQueryResultHKT, any>;

/**
 * Carga el catálogo de ejemplo y los ajustes iniciales. Se puede correr las veces que haga falta:
 * actualiza lo que ya existe y no pisa ajustes ni días de agenda que el admin ya tocó.
 */
export async function seedDatabase(db: AnyDb, now = new Date()) {
  const rows = buildSeedRows(now);

  for (const product of rows.products) {
    await db
      .insert(products)
      .values(product)
      .onConflictDoUpdate({
        target: products.sku,
        set: {
          name: product.name,
          category: product.category,
          netWeightG: product.netWeightG,
          macros: product.macros,
          price: product.price,
          updatedAt: sql`now()`,
        },
      });
  }

  for (const tier of rows.packPricingTiers) {
    await db
      .insert(packPricingTiers)
      .values(tier)
      .onConflictDoUpdate({
        target: [packPricingTiers.category, packPricingTiers.size],
        set: { price: tier.price },
      });
  }

  for (const tier of rows.shippingTiers) {
    await db
      .insert(shippingTiers)
      .values(tier)
      .onConflictDoUpdate({ target: shippingTiers.upToM, set: { fee: tier.fee } });
  }

  await db.insert(settings).values(rows.settings).onConflictDoNothing();
  await db.insert(deliveryDays).values(rows.deliveryDays).onConflictDoNothing();

  return {
    products: rows.products.length,
    packPricingTiers: rows.packPricingTiers.length,
    shippingTiers: rows.shippingTiers.length,
    deliveryDays: rows.deliveryDays.length,
  };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL (copiá .env.example a .env.local).");
  const summary = await seedDatabase(drizzle(neon(url)));
  console.log("Semillas cargadas:", summary);
}

// Solo corre al ejecutar el archivo directamente (npm run db:seed), no al importarlo en tests.
if (process.argv[1]?.endsWith("seed.ts")) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
