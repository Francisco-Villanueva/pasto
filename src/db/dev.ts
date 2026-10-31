import path from "node:path";
import { createStaffUser } from "../server/auth/users";
import { seedDemoOrders } from "./dev-orders";
import { seedDatabase } from "./seed";
import { settings } from "./schema";
import type { AppDb } from "./types";

export const DEV_STAFF = [
  {
    email: "admin@pasto.test",
    password: "admin-dev-1234",
    role: "ADMIN",
    fullName: "Admin de prueba",
  },
  {
    email: "cocina@pasto.test",
    password: "cocina-dev-1234",
    role: "COCINA",
    fullName: "Cocina de prueba",
  },
] as const;

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

  // Usuarios de staff FALSOS, solo para probar el backoffice en desarrollo.
  for (const user of DEV_STAFF) await createStaffUser(db as unknown as AppDb, user);

  // Pedidos de ejemplo para tener qué mirar en el backoffice. Si algo falla no se corta el arranque.
  try {
    await seedDemoOrders(db as unknown as AppDb);
  } catch (error) {
    console.warn("No se pudieron crear los pedidos de ejemplo:", error);
  }

  return db as unknown as AppDb;
}
