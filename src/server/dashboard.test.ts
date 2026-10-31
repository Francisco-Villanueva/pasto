import { beforeAll, describe, expect, it } from "vitest";
import type { AppDb } from "@/db/types";
import { changeOrderStatus, createManualOrder } from "./admin-orders";
import { createStaffUser } from "./auth/users";
import { loadDashboard } from "./dashboard";
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

async function manual(phone: string) {
  const result = await createManualOrder(db, {
    input: {
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
      customer: { name: "Cliente", phone, email: "" },
      paymentMethod: "EFECTIVO",
    },
    actorId: adminId,
    now: TEST_NOW,
  });
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.order;
}

describe("panel", () => {
  it("sin pedidos todo está en cero y no hay próxima entrega", async () => {
    expect(await loadDashboard(db, TEST_NOW)).toEqual({
      toConfirm: 0,
      preliminary: 0,
      feeToConfirm: 0,
      next: null,
    });
  });

  it("los importes solo cuentan pedidos confirmados en adelante", async () => {
    const toConfirm = await manual("+5491155550401");
    const confirmed = await manual("+5491155550402");
    const cancelled = await manual("+5491155550403");
    await changeOrderStatus(db, {
      orderId: confirmed.id,
      to: "CONFIRMADO",
      role: "ADMIN",
      actorId: adminId,
      now: TEST_NOW,
    });
    await changeOrderStatus(db, {
      orderId: cancelled.id,
      to: "CANCELADO",
      reason: "Prueba",
      role: "ADMIN",
      actorId: adminId,
      now: TEST_NOW,
    });

    const data = await loadDashboard(db, TEST_NOW);
    expect(toConfirm.id).toBeTruthy();
    expect(data.toConfirm).toBe(1);
    expect(data.next?.date).toBe("2026-11-04");
    // El cancelado no cuenta; el pendiente de confirmación cuenta como pedido pero no como ingreso.
    expect(data.next?.orders).toBe(2);
    expect(data.next?.revenueCents).toBe(2_150_000);
    expect(data.next?.unpaid).toBe(1);
  });
});
