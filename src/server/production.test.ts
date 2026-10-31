import { beforeAll, describe, expect, it } from "vitest";
import type { AppDb } from "@/db/types";
import { changeOrderStatus, createManualOrder } from "./admin-orders";
import { createStaffUser } from "./auth/users";
import { listProductionDates, loadProductionSheet } from "./production";
import { createTestDb, productIds, TEST_NOW } from "./test-db";

let db: AppDb;
let id: (sku: string) => string;
let adminId: string;

beforeAll(async () => {
  db = await createTestDb();
  id = await productIds(db);
  const admin = await createStaffUser(db, {
    email: "ana@pasto.test",
    password: "una-clave-larga-123",
    role: "ADMIN",
    fullName: "Ana",
  });
  if (!admin.ok) throw new Error(admin.message);
  adminId = admin.user.id;
});

async function order(sku: string, phone: string, slot = "12:00 a 14:00") {
  const result = await createManualOrder(db, {
    input: {
      cart: {
        packs: [
          { id: "a", category: "ESENCIAL", size: 5, items: [{ productId: id(sku), quantity: 5 }] },
        ],
        complements: [],
      },
      deliveryType: "RETIRO",
      scheduledDate: "2026-11-04",
      timeSlot: slot,
      customer: { name: "Cliente", phone, email: "" },
      paymentMethod: "EFECTIVO",
    },
    actorId: adminId,
    now: TEST_NOW,
  });
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.order;
}

const move = (orderId: string, to: Parameters<typeof changeOrderStatus>[1]["to"]) =>
  changeOrderStatus(db, { orderId, to, role: "ADMIN", actorId: adminId, now: TEST_NOW });

describe("hoja de producción", () => {
  it("sin pedidos confirmados no hay fechas ni filas", async () => {
    const pending = await order("ESE-001", "+5491155550201");
    expect(await listProductionDates(db, TEST_NOW)).toEqual([]);
    expect((await loadProductionSheet(db, "2026-11-04")).orders).toEqual([]);
    await move(pending.id, "CANCELADO");
  });

  it("agrega por receta los confirmados y en producción, y muestra los listos aparte", async () => {
    const a = await order("ESE-001", "+5491155550202");
    const b = await order("ESE-001", "+5491155550203", "18:00 a 20:00");
    const c = await order("ESE-003", "+5491155550204");
    for (const o of [a, b, c]) await move(o.id, "CONFIRMADO");
    await move(b.id, "EN_PRODUCCION");
    await move(c.id, "EN_PRODUCCION");
    await move(c.id, "LISTO");

    expect(await listProductionDates(db, TEST_NOW)).toEqual(["2026-11-04"]);
    const sheet = await loadProductionSheet(db, "2026-11-04");

    expect(sheet.orders).toHaveLength(3);
    // LISTO no suma: ya está cocinado.
    expect(sheet.rows).toHaveLength(1);
    expect(sheet.rows[0]?.units).toBe(10);
    expect(sheet.orders.find((o) => o.id === c.id)?.status).toBe("LISTO");
  });

  it("no expone importes ni datos del cliente", async () => {
    const sheet = await loadProductionSheet(db, "2026-11-04");
    const json = JSON.stringify(sheet);
    expect(json).not.toMatch(/total|price|precio|phone|customer|5491155/i);
  });

  it("las fechas pasadas no se ofrecen", async () => {
    const later = new Date("2026-11-10T10:00:00-03:00");
    expect(await listProductionDates(db, later)).toEqual([]);
  });
});
