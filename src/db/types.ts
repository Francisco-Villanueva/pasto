import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";

/** Cualquier base Drizzle de Postgres (Neon en producción, PGlite en desarrollo y tests). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AppDb = PgDatabase<PgQueryResultHKT, any>;
