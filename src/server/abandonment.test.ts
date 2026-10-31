import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { orderChanges, orders } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { changeOrderStatus, getOrderDetail } from "./admin-orders";
import { ABANDONMENT_REASON, cancelAbandonedOrders } from "./abandonment";
import { saveGeneralSettings } from "./admin-agenda";
import { createStaffUser } from "./auth/users";
import { createPreliminaryOrder } from "./orders";
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

async function preliminary(phone: string) {
  const result = await createPreliminaryOrder(
    db,
    {
      cart: {
        packs: [
          {
            id: "a",
            category: "ESENCIAL",
            size: 5,
            items: [{ productId: id("ESE-001"), quantity: 5 }],
          },
        ],
        complements: [],
      },
      deliveryType: "RETIRO",
      scheduledDate: "2026-11-04",
      timeSlot: "12:00 a 14:00",
      customer: { name: "Lucía", phone, email: "" },
      consentCommercial: false,
      acceptTerms: true,
    },
    { now: TEST_NOW, distanceFor: async () => null },
  );
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.order;
}

const hoursLater = (h: number) => new Date(TEST_NOW.getTime() + h * 3_600_000);

describe("cancelación por abandono", () => {
  it("cancela solo los preliminares que pasaron el plazo (48 h por defecto)", async () => {
    const old = await preliminary("+5491155550301");
    const pending = await preliminary("+5491155550302");
    await changeOrderStatus(db, {
      orderId: pending.id,
      to: "PENDIENTE_CONFIRMACION",
      role: "ADMIN",
      actorId: adminId,
      now: TEST_NOW,
    });

    expect(await cancelAbandonedOrders(db, hoursLater(47))).toBe(0);
    expect(await cancelAbandonedOrders(db, hoursLater(48))).toBe(1);

    const [cancelled] = await db.select().from(orders).where(eq(orders.id, old.id));
    expect(cancelled?.status).toBe("CANCELADO");
    expect(cancelled?.cancellationReason).toBe(ABANDONMENT_REASON);
    const [kept] = await db.select().from(orders).where(eq(orders.id, pending.id));
    expect(kept?.status).toBe("PENDIENTE_CONFIRMACION");

    // Queda en el historial a nombre del sistema.
    const history = await db.select().from(orderChanges).where(eq(orderChanges.orderId, old.id));
    expect(history.some((h) => h.changedBy === null && h.note === ABANDONMENT_REASON)).toBe(true);
  });

  it("es reversible: el admin reactiva el pedido cancelado", async () => {
    const [cancelled] = await db.select().from(orders).where(eq(orders.status, "CANCELADO"));
    const result = await changeOrderStatus(db, {
      orderId: cancelled!.id,
      to: "PRELIMINAR",
      role: "ADMIN",
      actorId: adminId,
      now: hoursLater(49),
    });
    expect(result.ok).toBe(true);
    expect((await getOrderDetail(db, cancelled!.id))?.status).toBe("PRELIMINAR");
  });

  it("con el plazo en 0 horas la regla queda desactivada", async () => {
    await saveGeneralSettings(db, { abandonAfterHours: 0, defaultSlots: ["12:00 a 14:00"] });
    expect(await cancelAbandonedOrders(db, hoursLater(24 * 30))).toBe(0);
  });

  it("respeta un plazo configurado", async () => {
    await saveGeneralSettings(db, { abandonAfterHours: 6, defaultSlots: ["12:00 a 14:00"] });
    const fresh = await preliminary("+5491155550303");
    expect(await cancelAbandonedOrders(db, hoursLater(5))).toBe(0);
    // El reactivado del test anterior (creado en TEST_NOW) también vence a las 6 h.
    expect(await cancelAbandonedOrders(db, hoursLater(6))).toBeGreaterThanOrEqual(1);
    const [row] = await db.select().from(orders).where(eq(orders.id, fresh.id));
    expect(row?.status).toBe("CANCELADO");
  });
});
