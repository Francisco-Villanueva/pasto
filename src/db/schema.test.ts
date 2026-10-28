import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { seedDatabase } from "./seed";
import { products } from "./schema";

const migrationsDir = path.join(process.cwd(), "drizzle");

let client: PGlite;

/** Postgres real en memoria con las migraciones aplicadas, para probar las restricciones. */
beforeAll(async () => {
  client = new PGlite();
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const statements = readFileSync(path.join(migrationsDir, file), "utf8").split(
      "--> statement-breakpoint",
    );
    for (const statement of statements) await client.exec(statement);
  }
});

const one = async (query: string, params: unknown[] = []) =>
  (await client.query(query, params)).rows[0] as Record<string, unknown>;

const rejects = async (query: string, params: unknown[] = []) => {
  let error: unknown;
  try {
    await client.query(query, params);
  } catch (e) {
    error = e;
  }
  expect(error, `debería fallar: ${query}`).toBeDefined();
};

async function newOrder(overrides: Record<string, string> = {}) {
  const values = {
    customer_name: "'Ana'",
    customer_phone: "'+5491112345678'",
    delivery_type: "'RETIRO'",
    scheduled_date: "'2026-11-04'",
    scheduled_time_slot: "'12:00 a 14:00'",
    subtotal: "1000",
    total: "1000",
    ...overrides,
  };
  const sqlText = `INSERT INTO orders (${Object.keys(values).join(", ")})
    VALUES (${Object.values(values).join(", ")}) RETURNING id, order_number, status, survey_token`;
  return (await client.query(sqlText)).rows[0] as {
    id: string;
    order_number: string;
    status: string;
    survey_token: string;
  };
}

describe("migraciones", () => {
  it("numera los pedidos con una secuencia PAS-000101, 102, ...", async () => {
    const first = await newOrder();
    const second = await newOrder();
    expect(first.order_number).toBe("PAS-000101");
    expect(second.order_number).toBe("PAS-000102");
    expect(first.status).toBe("PRELIMINAR");
    expect(first.survey_token).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("un pedido cancelado exige motivo", async () => {
    await rejects(`UPDATE orders SET status = 'CANCELADO' WHERE order_number = 'PAS-000101'`);
    await client.query(
      `UPDATE orders SET status = 'CANCELADO', cancellation_reason = 'ABANDONADO' WHERE order_number = 'PAS-000101'`,
    );
  });

  it("retiro no puede tener estado de envío calculado", async () => {
    await rejects(
      `INSERT INTO orders (customer_name, customer_phone, delivery_type, delivery_fee_status,
        scheduled_date, scheduled_time_slot, subtotal, total)
       VALUES ('A', '1', 'RETIRO', 'CALCULADO', '2026-11-04', 'x', 1, 1)`,
    );
  });

  it("los complementos necesitan precio; los platos no", async () => {
    await rejects(
      `INSERT INTO products (sku, name, category) VALUES ('X1', 'Pollo', 'COMPLEMENTO')`,
    );
    await client.query(
      `INSERT INTO products (sku, name, category) VALUES ('X2', 'Plato', 'ESENCIAL')`,
    );
  });

  it("la tabla de precios no admite complementos ni tamaños repetidos", async () => {
    await rejects(
      `INSERT INTO pack_pricing_tiers (category, size, price) VALUES ('COMPLEMENTO', 1, 10)`,
    );
    await client.query(
      `INSERT INTO pack_pricing_tiers (category, size, price) VALUES ('ESENCIAL', 5, 10)`,
    );
    await rejects(
      `INSERT INTO pack_pricing_tiers (category, size, price) VALUES ('ESENCIAL', 5, 20)`,
    );
  });

  it("no hay dos tareas CRM del mismo tipo para un pedido", async () => {
    const order = await newOrder();
    const insert = `INSERT INTO crm_tasks (order_id, type, scheduled_for) VALUES ($1, 'D5_CHECKIN', '2026-11-09')`;
    await client.query(insert, [order.id]);
    await rejects(insert, [order.id]);
  });

  it("las reseñas: una por plato y pedido, notas de 1 a 5, y sin notas si no lo probó", async () => {
    const order = await newOrder();
    const product = await one(`SELECT id FROM products WHERE sku = 'X2'`);
    const insert = (cols: string, vals: string) =>
      `INSERT INTO product_reviews (order_id, product_id, recipe_version, ${cols})
       VALUES ('${order.id}', '${product.id}', 'v1.0', ${vals})`;

    await rejects(insert("rating_overall", "6"));
    await rejects(insert("not_tested_yet, rating_flavor", "true, 4"));
    await client.query(insert("rating_overall", "4")); // guardado parcial: solo la nota general
    await rejects(insert("rating_overall", "5")); // misma clave: la app hace upsert
  });

  it("el detalle del pedido no admite cantidades en cero", async () => {
    const order = await newOrder();
    const product = await one(`SELECT id FROM products WHERE sku = 'X2'`);
    const item = await one(
      `INSERT INTO order_items (order_id, item_type, tier_size, category, unit_price, total_price)
       VALUES ('${order.id}', 'PACK', 5, 'ESENCIAL', 10, 10) RETURNING id`,
    );
    await rejects(
      `INSERT INTO order_item_details (order_item_id, product_id, product_name, recipe_version, quantity)
       VALUES ('${item.id}', '${product.id}', 'Plato', 'v1.0', 0)`,
    );
  });

  it("un pack necesita tamaño, un complemento no", async () => {
    const order = await newOrder();
    await rejects(
      `INSERT INTO order_items (order_id, item_type, category, unit_price, total_price)
       VALUES ('${order.id}', 'PACK', 'ESENCIAL', 10, 10)`,
    );
    await client.query(
      `INSERT INTO order_items (order_id, item_type, category, unit_price, total_price)
       VALUES ('${order.id}', 'COMPLEMENTO', 'COMPLEMENTO', 10, 10)`,
    );
  });
});

describe("semillas", () => {
  it("cargan el catálogo de ejemplo y se pueden repetir sin duplicar", async () => {
    const db = drizzle(client);
    const now = new Date("2026-10-28T10:00:00-03:00");

    const first = await seedDatabase(db, now);
    const second = await seedDatabase(db, now);
    expect(second).toEqual(first);

    const rows = await db.select().from(products);
    const seeded = rows.filter((p) => p.sku.startsWith("ESE-") || p.sku.startsWith("COM-"));
    expect(seeded).toHaveLength(6);

    const counts = await one(`SELECT
      (SELECT count(*) FROM pack_pricing_tiers)::int AS tiers,
      (SELECT count(*) FROM shipping_tiers)::int AS shipping,
      (SELECT count(*) FROM settings)::int AS settings,
      (SELECT count(*) FROM delivery_days)::int AS days`);
    expect(counts).toMatchObject({ shipping: 3, settings: 3 });
    // ESENCIAL x5 ya existía (lo creó un test anterior): la semilla lo actualiza, no lo duplica.
    expect(Number(counts.tiers)).toBe(8);
    const tier = await one(
      `SELECT price FROM pack_pricing_tiers WHERE category = 'ESENCIAL' AND size = 5`,
    );
    expect(tier.price).toBe("21500.00");
  });

  it("guarda los precios como NUMERIC(10,2)", async () => {
    const row = await one(`SELECT price FROM products WHERE sku = 'COM-001'`);
    expect(row.price).toBe("9500.00");
  });
});
