import path from "node:path";
import { seedDatabase } from "./seed";
import { settings } from "./schema";
import type { AppDb } from "./types";

/**
 * Base de datos de DESARROLLO, en memoria (PGlite): con ella se puede usar toda la app sin
 * crear el proyecto de Neon. Se arma con las migraciones y el catálogo de ejemplo en cada arranque,
 * así que los pedidos de prueba no se conservan. Nunca se usa en producción.
 */
export async function createDevDb(): Promise<AppDb> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");

  const db = drizzle(new PGlite());
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  await seedDatabase(db);

  // Número de WhatsApp FALSO, solo para poder probar el checkout en desarrollo.
  await db
    .insert(settings)
    .values({ key: "pasto_whatsapp", value: "+5490000000000" })
    .onConflictDoNothing();

  return db as unknown as AppDb;
}
