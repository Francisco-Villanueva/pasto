import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Las variables locales viven en .env.local (o en .env).
config({ path: [".env.local", ".env"], quiet: true });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Conexión directa (sin pooler) para migraciones.
    url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? "",
  },
});
