import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { loadCatalogFromDb, loadSettingsFromDb, loadStoreCatalog } from "./catalog";
import { seedDatabase } from "./seed";
import { products } from "./schema";
import { eq } from "drizzle-orm";

const migrationsDir = path.join(process.cwd(), "drizzle");
const db = drizzle(new PGlite());

beforeAll(async () => {
  const client = (db as unknown as { $client: PGlite }).$client;
  for (const file of readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    for (const statement of readFileSync(path.join(migrationsDir, file), "utf8").split(
      "--> statement-breakpoint",
    )) {
      await client.exec(statement);
    }
  }
  await seedDatabase(db, new Date("2026-10-28T10:00:00-03:00"));
});

describe("loadCatalogFromDb", () => {
  it("lee productos y precios y los pasa a centavos", async () => {
    const catalog = await loadCatalogFromDb(db);

    expect(catalog.products).toHaveLength(13);
    const pollo = catalog.products.find((p) => p.sku === "COM-001");
    expect(pollo).toMatchObject({ category: "COMPLEMENTO", priceCents: 950_000, isActive: true });
    const milanesa = catalog.products.find((p) => p.sku === "ESE-001");
    expect(milanesa?.macros).toEqual({ calories: 520, protein: 38, carbs: 42, fats: 20 });
    expect(milanesa?.priceCents).toBeUndefined();

    expect(catalog.tiers).toHaveLength(8);
    expect(catalog.tiers).toContainEqual({ category: "ESENCIAL", size: 10, priceCents: 4_000_000 });
  });

  it("incluye los platos inactivos, marcados, para avisar en carritos viejos", async () => {
    await db.update(products).set({ isActive: false }).where(eq(products.sku, "ESE-002"));
    const catalog = await loadCatalogFromDb(db);
    expect(catalog.products.find((p) => p.sku === "ESE-002")?.isActive).toBe(false);
  });
});

describe("loadSettingsFromDb", () => {
  it("devuelve los ajustes como objeto", async () => {
    const result = await loadSettingsFromDb(db);
    expect(result).toMatchObject({ abandon_after_hours: 48, delivery_max_distance_m: 10_000 });
    expect(result.fudo_url).toBeUndefined();
  });
});

describe("loadStoreCatalog sin base de datos", () => {
  it("usa el catálogo de ejemplo", async () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const catalog = await loadStoreCatalog();
      expect(catalog.products.some((p) => p.sku === "ESE-001")).toBe(true);
    } finally {
      if (previous !== undefined) process.env.DATABASE_URL = previous;
    }
  });
});
