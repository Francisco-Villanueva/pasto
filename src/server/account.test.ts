import { beforeAll, describe, expect, it } from "vitest";
import { loadCatalogFromDb } from "@/db/catalog";
import type { AppDb } from "@/db/types";
import { toDomainCatalog } from "@/domain/store-catalog";
import { changeOrderStatus, createManualOrder } from "./admin-orders";
import { loadRepeat, listAccountOrders } from "./account";
import { createStaffUser } from "./auth/users";
import {
  createCustomerSession,
  destroyCustomerSession,
  findCustomerSession,
  upsertCustomerAccount,
} from "./customer-auth";
import { setProductActive } from "./admin-catalog";
import { createTestDb, productIds, TEST_NOW } from "./test-db";

let db: AppDb;
let id: (sku: string) => string;
let adminId: string;
let orderId: string;

const DELIVERED = new Date("2026-11-04T15:00:00-03:00");

async function makeOrder(email: string, name: string) {
  const created = await createManualOrder(db, {
    input: {
      cart: {
        packs: [
          {
            id: "a",
            category: "ESENCIAL",
            size: 5,
            items: [
              { productId: id("ESE-001"), quantity: 3 },
              { productId: id("ESE-003"), quantity: 2 },
            ],
          },
        ],
        complements: [{ productId: id("COM-001"), quantity: 1 }],
      },
      deliveryType: "RETIRO",
      scheduledDate: "2026-11-04",
      timeSlot: "12:00 a 14:00",
      customer: { name, phone: "+5491155550501", email },
      paymentMethod: "EFECTIVO",
    },
    actorId: adminId,
    now: TEST_NOW,
  });
  if (!created.ok) throw new Error(JSON.stringify(created));
  return created.order.id;
}

beforeAll(async () => {
  db = await createTestDb();
  id = await productIds(db);
  const admin = await createStaffUser(db, {
    email: "ana@pasto.test",
    password: "una-clave-larga-123",
    role: "ADMIN",
  });
  if (!admin.ok) throw new Error(admin.message);
  adminId = admin.user.id;
  orderId = await makeOrder("Sofia.Diaz@Gmail.com", "Sofía");
  await makeOrder("otra@gmail.com", "Otra");
});

describe("sesión del cliente", () => {
  it("la misma persona de Google es siempre la misma cuenta", async () => {
    const a = await upsertCustomerAccount(db, {
      sub: "g-1",
      email: "sofia.diaz@gmail.com",
      name: "Sofía",
    });
    const b = await upsertCustomerAccount(db, {
      sub: "g-1",
      email: "nuevo@gmail.com",
      name: "Sofía D.",
    });
    expect(b.id).toBe(a.id);
    expect(b.email).toBe("nuevo@gmail.com");
    await upsertCustomerAccount(db, { sub: "g-1", email: "sofia.diaz@gmail.com", name: "Sofía" });
  });

  it("la sesión se encuentra, vence y se cierra", async () => {
    const account = await upsertCustomerAccount(db, {
      sub: "g-1",
      email: "sofia.diaz@gmail.com",
      name: null,
    });
    const { token } = await createCustomerSession(db, account.id, TEST_NOW);
    expect((await findCustomerSession(db, token, TEST_NOW))?.email).toBe("sofia.diaz@gmail.com");
    expect(await findCustomerSession(db, token, new Date("2027-01-01T00:00:00Z"))).toBeNull();
    await destroyCustomerSession(db, token);
    expect(await findCustomerSession(db, token, TEST_NOW)).toBeNull();
    expect(await findCustomerSession(db, "corto")).toBeNull();
  });
});

describe("mi cuenta", () => {
  it("muestra los pedidos del mismo email, sin importar mayúsculas, y no los de otros", async () => {
    const list = await listAccountOrders(db, "sofia.diaz@gmail.com", TEST_NOW);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: orderId, surveyToken: null });
    expect(list[0]!.summary).toEqual(expect.arrayContaining(["Esenciales de 5", "Complementos"]));
    expect(await listAccountOrders(db, "nadie@gmail.com", TEST_NOW)).toEqual([]);
  });

  it("la encuesta aparece solo con el pedido entregado y vigente", async () => {
    await changeOrderStatus(db, {
      orderId,
      to: "ENTREGADO",
      role: "ADMIN",
      actorId: adminId,
      now: DELIVERED,
    });
    const soon = new Date(DELIVERED.getTime() + 5 * 86_400_000);
    const late = new Date(DELIVERED.getTime() + 70 * 86_400_000);
    expect(
      (await listAccountOrders(db, "sofia.diaz@gmail.com", soon))[0]!.surveyToken,
    ).toBeTruthy();
    expect((await listAccountOrders(db, "sofia.diaz@gmail.com", late))[0]!.surveyToken).toBeNull();
  });

  it("repetir arma el carrito con los mismos platos y sin precios", async () => {
    const catalog = toDomainCatalog(await loadCatalogFromDb(db));
    const r = await loadRepeat(db, { email: "SOFIA.diaz@gmail.com", orderId, catalog });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.result.unavailableProductIds).toEqual([]);
    expect(r.result.cart.packs).toHaveLength(1);
    expect(r.result.cart.packs[0]!.items).toEqual(
      expect.arrayContaining([
        { productId: id("ESE-001"), quantity: 3 },
        { productId: id("ESE-003"), quantity: 2 },
      ]),
    );
    expect(r.result.cart.complements).toEqual([{ productId: id("COM-001"), quantity: 1 }]);
  });

  it("no deja repetir un pedido ajeno", async () => {
    const catalog = toDomainCatalog(await loadCatalogFromDb(db));
    expect(await loadRepeat(db, { email: "otra@gmail.com", orderId, catalog })).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("un plato discontinuado vuelve afuera y se informa por nombre", async () => {
    await setProductActive(db, { id: id("ESE-003"), active: false });
    const catalog = toDomainCatalog(await loadCatalogFromDb(db));
    const r = await loadRepeat(db, { email: "sofia.diaz@gmail.com", orderId, catalog });
    if (!r.ok) throw new Error("debería cargar");
    expect(r.result.unavailableProductIds).toEqual([id("ESE-003")]);
    expect(r.unavailableNames).toEqual(["Guiso de lentejas"]);
    expect(r.result.cart.packs[0]!.items).toEqual([{ productId: id("ESE-001"), quantity: 3 }]);
  });
});
