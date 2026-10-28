import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";
import type { AppDb } from "./types";

const globalForDb = globalThis as unknown as { __pastoDb?: Promise<AppDb> };

/** ¿Hay una base de datos disponible? Con DATABASE_URL, o en desarrollo (base en memoria). */
export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL) || process.env.NODE_ENV === "development";
}

async function create(): Promise<AppDb> {
  const url = process.env.DATABASE_URL;

  if (url) {
    // Pool por WebSocket: permite transacciones, que el pedido necesita para guardarse completo o nada.
    if (typeof WebSocket === "undefined") {
      const { default: ws } = await import("ws");
      neonConfig.webSocketConstructor = ws;
    }
    return drizzle(new Pool({ connectionString: url }), { schema }) as unknown as AppDb;
  }

  if (process.env.NODE_ENV === "development") {
    const { createDevDb } = await import("./dev");
    return createDevDb();
  }

  throw new Error("Falta DATABASE_URL.");
}

/** Cliente de base de datos, creado la primera vez que se pide y compartido entre llamadas. */
export function getDb(): Promise<AppDb> {
  globalForDb.__pastoDb ??= create();
  return globalForDb.__pastoDb;
}

export { schema };
export type { AppDb };
