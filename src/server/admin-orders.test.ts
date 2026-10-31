import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { crmTasks, customers, orderChanges, orderItems, orders } from "@/db/schema";
import type { AppDb } from "@/db/types";
import type { AdminOrderInput } from "@/lib/admin-order-schema";
import type { CheckoutInput } from "@/lib/checkout-schema";
import {
  changeOrderStatus,
  createManualOrder,
  getOrderDetail,
  listOrderDates,
  listOrders,
  PAGE_SIZE,
  updateOrder,
  updatePayment,
} from "./admin-orders";
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

/** Los pedidos de los tests se crean a esta hora… */
const createDeps = { now: TEST_NOW, distanceFor: async () => 2_400 };
/** …y todo lo que se hace después ocurre un minuto más tarde (el historial se ordena por hora). */
const LATER = new Date(TEST_NOW.getTime() + 60_000);
const deps = { now: LATER, distanceFor: async () => 2_400 };

const esencial5 = () => ({
  id: "a",
  category: "ESENCIAL" as const,
  size: 5,
  items: [{ productId: id("ESE-001"), quantity: 5 }],
});

function webInput(
  overrides: Partial<CheckoutInput> = {},
  phone = "+54 9 11 5555 0001",
): CheckoutInput {
  return {
    cart: { packs: [esencial5()], complements: [] },
    deliveryType: "RETIRO",
    scheduledDate: "2026-11-04",
    timeSlot: "12:00 a 14:00",
    customer: { name: "Lucía Romero", phone, email: "" },
    consentCommercial: true,
    acceptTerms: true,
    ...overrides,
  };
}

function adminInput(
  overrides: Partial<AdminOrderInput> = {},
  phone = "+54 9 11 5555 0001",
): AdminOrderInput {
  return {
    cart: { packs: [esencial5()], complements: [] },
    deliveryType: "RETIRO",
    scheduledDate: "2026-11-04",
    timeSlot: "12:00 a 14:00",
    customer: { name: "Lucía Romero", phone, email: "" },
    ...overrides,
  };
}

async function newWebOrder(overrides: Partial<CheckoutInput> = {}, phone?: string) {
  const result = await createPreliminaryOrder(db, webInput(overrides, phone), createDeps);
  if (!result.ok) throw new Error(JSON.stringify(result));
  return result.order;
}

describe("listado", () => {
  let first: { id: string; orderNumber: string };
  let second: { id: string; orderNumber: string };
  let manual: { id: string; orderNumber: string };

  beforeAll(async () => {
    first = await newWebOrder({}, "+54 9 11 5555 0001");
    second = await newWebOrder(
      {
        deliveryType: "DELIVERY",
        address: { street: "Alsina", number: "456", neighborhood: "Centro" },
        placeId: "p",
        scheduledDate: "2026-11-11",
        customer: { name: "Martín Paz", phone: "+54 9 291 555 0123", email: "" },
      },
      "+54 9 291 555 0123",
    );
    const result = await createManualOrder(db, {
      input: adminInput({
        customer: { name: "Camila Ortiz", phone: "+54 9 11 5555 0003", email: "" },
      }),
      actorId: adminId,
      ...deps,
    });
    if (!result.ok) throw new Error(JSON.stringify(result));
    manual = result.order;
  });

  it("muestra todos, los más próximos a entregar primero, con importes", async () => {
    const list = await listOrders(db);
    expect(list.total).toBe(3);
    expect(list.rows.map((r) => r.orderNumber)).toEqual([
      second.orderNumber,
      manual.orderNumber,
      first.orderNumber,
    ]);
    expect(list.rows[0]).toMatchObject({
      customerName: "Martín Paz",
      totalCents: 2_300_000,
      origin: "WEB",
    });
    expect(list.rows[1]).toMatchObject({ origin: "MANUAL", status: "PENDIENTE_CONFIRMACION" });
  });

  it("filtra por fecha, estado, tipo de entrega y pago", async () => {
    expect((await listOrders(db, { date: "2026-11-04" })).total).toBe(2);
    expect((await listOrders(db, { status: "PRELIMINAR" })).total).toBe(2);
    expect(
      (await listOrders(db, { status: "PENDIENTE_CONFIRMACION" })).rows.map((r) => r.id),
    ).toEqual([manual.id]);
    expect((await listOrders(db, { deliveryType: "DELIVERY" })).rows.map((r) => r.id)).toEqual([
      second.id,
    ]);
    expect((await listOrders(db, { paymentStatus: "PAGADO" })).total).toBe(0);
  });

  it("busca por número, nombre o teléfono (aunque lo escriban con espacios)", async () => {
    expect((await listOrders(db, { q: first.orderNumber })).rows.map((r) => r.id)).toEqual([
      first.id,
    ]);
    expect((await listOrders(db, { q: "camila" })).rows.map((r) => r.id)).toEqual([manual.id]);
    expect((await listOrders(db, { q: "291 555 0123" })).rows.map((r) => r.id)).toEqual([
      second.id,
    ]);
    expect((await listOrders(db, { q: "nadie-con-este-nombre" })).total).toBe(0);
  });

  it("los comodines de SQL escritos en la búsqueda no devuelven todo", async () => {
    expect((await listOrders(db, { q: "%" })).total).toBe(0);
    expect((await listOrders(db, { q: "_" })).total).toBe(0);
  });

  it("pagina de a 25 y no se sale de rango", async () => {
    for (let i = 0; i < PAGE_SIZE; i++) {
      await db.insert(orders).values({
        customerName: `Cliente ${i}`,
        customerPhone: `+5491100000${String(i).padStart(3, "0")}`,
        deliveryType: "RETIRO",
        scheduledDate: "2026-10-01",
        scheduledTimeSlot: "12:00 a 14:00",
        subtotal: "100.00",
        total: "100.00",
      });
    }
    const page1 = await listOrders(db, { page: 1 });
    const page2 = await listOrders(db, { page: 2 });
    expect(page1).toMatchObject({ total: 28, pageCount: 2 });
    expect(page1.rows).toHaveLength(PAGE_SIZE);
    expect(page2.rows).toHaveLength(3);
    expect((await listOrders(db, { page: 99 })).page).toBe(2);
    expect((await listOrders(db, { page: -4 })).page).toBe(1);
    await db.delete(orders).where(eq(orders.scheduledDate, "2026-10-01"));
  });

  it("lista las fechas con pedidos para el filtro", async () => {
    expect(await listOrderDates(db)).toEqual(["2026-11-11", "2026-11-04"]);
  });
});

describe("detalle", () => {
  it("trae ítems, importes e historial con quién hizo cada cambio", async () => {
    const order = await newWebOrder({}, "+54 9 11 5555 0010");
    await changeOrderStatus(db, {
      orderId: order.id,
      to: "PENDIENTE_CONFIRMACION",
      role: "ADMIN",
      actorId: adminId,
      now: TEST_NOW,
    });

    const detail = await getOrderDetail(db, order.id);
    expect(detail).toMatchObject({
      orderNumber: order.orderNumber,
      status: "PENDIENTE_CONFIRMACION",
      subtotalCents: 2_150_000,
      totalCents: 2_150_000,
      deliveryFeeCents: 0,
      paymentStatus: "PENDIENTE",
    });
    expect(detail?.items).toHaveLength(1);
    expect(detail?.items[0]?.details[0]).toMatchObject({
      productName: "Milanesa de pollo napolitana",
      quantity: 5,
    });
    expect(detail?.changes.map((c) => [c.kind, c.actor])).toEqual([
      ["ESTADO", "Ana"],
      ["ESTADO", null],
    ]);
  });

  it("devuelve null con un id inválido o inexistente", async () => {
    expect(await getOrderDetail(db, "no-es-un-id")).toBeNull();
    expect(await getOrderDetail(db, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});

describe("cambio de estado", () => {
  it("avanza con la matriz del dominio y lo deja en el historial con motivo y autor", async () => {
    const order = await newWebOrder({}, "+54 9 11 5555 0020");
    const step = (
      to: Parameters<typeof changeOrderStatus>[1]["to"],
      role: "ADMIN" | "COCINA" = "ADMIN",
    ) => changeOrderStatus(db, { orderId: order.id, to, role, actorId: adminId, now: LATER });

    expect(await step("PENDIENTE_CONFIRMACION")).toEqual({
      ok: true,
      from: "PRELIMINAR",
      to: "PENDIENTE_CONFIRMACION",
    });
    expect((await step("CONFIRMADO")).ok).toBe(true);
    expect((await step("EN_PRODUCCION", "COCINA")).ok).toBe(true);
    expect((await step("LISTO", "COCINA")).ok).toBe(true);

    const history = await db.select().from(orderChanges).where(eq(orderChanges.orderId, order.id));
    expect(history).toHaveLength(5); // creación + 4 cambios
    expect(history.filter((h) => h.changedBy === adminId)).toHaveLength(4);
  });

  it("Cocina solo puede marcar EN_PRODUCCION y LISTO", async () => {
    const order = await newWebOrder({}, "+54 9 11 5555 0021");
    const as = (to: Parameters<typeof changeOrderStatus>[1]["to"]) =>
      changeOrderStatus(db, {
        orderId: order.id,
        to,
        role: "COCINA",
        actorId: adminId,
        now: TEST_NOW,
      });

    expect(await as("PENDIENTE_CONFIRMACION")).toEqual({ ok: false, code: "FORBIDDEN_ROLE" });
    expect(await as("CANCELADO")).toEqual({ ok: false, code: "FORBIDDEN_ROLE" });
    expect(await as("ENTREGADO")).toEqual({ ok: false, code: "FORBIDDEN_ROLE" });
  });

  it("rechaza transiciones inválidas, el mismo estado y pedidos inexistentes", async () => {
    const order = await newWebOrder({}, "+54 9 11 5555 0022");
    const go = (to: Parameters<typeof changeOrderStatus>[1]["to"], orderId = order.id) =>
      changeOrderStatus(db, { orderId, to, role: "ADMIN", actorId: adminId, now: LATER });

    expect(await go("PRELIMINAR")).toEqual({ ok: false, code: "SAME_STATUS" });
    expect(await go("CANCELADO", "00000000-0000-4000-8000-000000000000")).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
    expect(await go("CANCELADO", "no-es-un-id")).toEqual({ ok: false, code: "NOT_FOUND" });
    await go("ENTREGADO"); // saltar hacia adelante sí se puede
    expect(await go("CONFIRMADO")).toEqual({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("cancelar exige motivo, lo guarda, y reactivar lo borra", async () => {
    const order = await newWebOrder({}, "+54 9 11 5555 0023");
    const go = (to: Parameters<typeof changeOrderStatus>[1]["to"], reason?: string) =>
      changeOrderStatus(db, {
        orderId: order.id,
        to,
        role: "ADMIN",
        actorId: adminId,
        reason,
        now: TEST_NOW,
      });

    expect(await go("CANCELADO")).toEqual({ ok: false, code: "REASON_REQUIRED" });
    expect(await go("CANCELADO", "   ")).toEqual({ ok: false, code: "REASON_REQUIRED" });
    expect((await go("CANCELADO", "El cliente no respondió")).ok).toBe(true);

    let [row] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(row).toMatchObject({
      status: "CANCELADO",
      cancellationReason: "El cliente no respondió",
    });

    expect((await go("PENDIENTE_CONFIRMACION")).ok).toBe(true);
    [row] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(row).toMatchObject({ status: "PENDIENTE_CONFIRMACION", cancellationReason: null });

    const detail = await getOrderDetail(db, order.id);
    expect(detail?.changes.find((c) => c.note === "El cliente no respondió")?.actor).toBe("Ana");
  });

  it("al entregar crea el seguimiento a los 5 y 12 días y completa delivered_at", async () => {
    const order = await newWebOrder({}, "+54 9 11 5555 0024");
    const deliveredAt = new Date("2026-11-04T19:30:00-03:00");
    const result = await changeOrderStatus(db, {
      orderId: order.id,
      to: "ENTREGADO",
      role: "ADMIN",
      actorId: adminId,
      now: deliveredAt,
    });
    expect(result.ok).toBe(true);

    const tasks = await db.select().from(crmTasks).where(eq(crmTasks.orderId, order.id));
    expect(tasks.map((t) => [t.type, t.scheduledFor, t.status]).sort()).toEqual([
      ["D12_SURVEY", "2026-11-16", "PENDIENTE"],
      ["D5_CHECKIN", "2026-11-09", "PENDIENTE"],
    ]);
    expect(tasks[0]?.customerId).not.toBeNull();

    const [row] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(row?.deliveredAt).toEqual(deliveredAt);
  });

  it("corregir la entrega borra las tareas pendientes, conserva las completadas y no duplica al volver a entregar", async () => {
    const order = await newWebOrder({}, "+54 9 11 5555 0025");
    const go = (to: Parameters<typeof changeOrderStatus>[1]["to"], at = TEST_NOW) =>
      changeOrderStatus(db, { orderId: order.id, to, role: "ADMIN", actorId: adminId, now: at });

    await go("ENTREGADO", new Date("2026-11-04T19:00:00-03:00"));
    await db
      .update(crmTasks)
      .set({ status: "COMPLETADA", resultNotes: "Todo bien" })
      .where(eq(crmTasks.orderId, order.id) && eq(crmTasks.type, "D5_CHECKIN"));

    await go("LISTO"); // se corrige: no se entregó
    let tasks = await db.select().from(crmTasks).where(eq(crmTasks.orderId, order.id));
    expect(tasks.map((t) => [t.type, t.status])).toEqual([["D5_CHECKIN", "COMPLETADA"]]);
    const [undone] = await db.select().from(orders).where(eq(orders.id, order.id));
    expect(undone?.deliveredAt).toBeNull();

    await go("ENTREGADO", new Date("2026-11-05T10:00:00-03:00"));
    tasks = await db.select().from(crmTasks).where(eq(crmTasks.orderId, order.id));
    expect(tasks).toHaveLength(2); // la D+5 completada se conserva; la D+12 se vuelve a crear
    expect(tasks.find((t) => t.type === "D5_CHECKIN")?.resultNotes).toBe("Todo bien");
    expect(tasks.find((t) => t.type === "D12_SURVEY")?.scheduledFor).toBe("2026-11-17");
  });
});

describe("pago", () => {
  it("cambia medio y estado y lo deja en el historial", async () => {
    const order = await newWebOrder({}, "+54 9 11 5555 0030");
    expect(
      await updatePayment(db, {
        orderId: order.id,
        method: "TRANSFERENCIA",
        status: "PAGADO",
        actorId: adminId,
        now: TEST_NOW,
      }),
    ).toEqual({ ok: true });

    const detail = await getOrderDetail(db, order.id);
    expect(detail).toMatchObject({ paymentMethod: "TRANSFERENCIA", paymentStatus: "PAGADO" });
    expect(detail?.changes[0]).toMatchObject({
      kind: "PAGO",
      actor: "Ana",
      before: { method: "PENDIENTE", status: "PENDIENTE" },
      after: { method: "TRANSFERENCIA", status: "PAGADO" },
    });
  });

  it("avisa si no hay nada que cambiar y si el pedido no existe", async () => {
    const order = await newWebOrder({}, "+54 9 11 5555 0031");
    expect(
      await updatePayment(db, { orderId: order.id, status: "PENDIENTE", actorId: adminId }),
    ).toEqual({ ok: false, code: "NOTHING_TO_CHANGE" });
    expect(
      await updatePayment(db, {
        orderId: "00000000-0000-4000-8000-000000000000",
        status: "PAGADO",
        actorId: adminId,
      }),
    ).toEqual({ ok: false, code: "NOT_FOUND" });
  });
});

describe("edición", () => {
  it("recalcula con los precios vigentes, reemplaza los ítems y registra qué cambió", async () => {
    const order = await newWebOrder({}, "+54 9 11 5555 0040");
    const input = adminInput(
      {
        cart: {
          packs: [
            {
              id: "b",
              category: "ESENCIAL",
              size: 10,
              items: [
                { productId: id("ESE-001"), quantity: 6 },
                { productId: id("ESE-003"), quantity: 4 },
              ],
            },
          ],
          complements: [{ productId: id("COM-001"), quantity: 1 }],
        },
        scheduledDate: "2026-11-11",
        timeSlot: "18:00 a 20:00",
      },
      "+54 9 11 5555 0040",
    );
    const result = await updateOrder(db, { orderId: order.id, input, actorId: adminId, ...deps });
    if (!result.ok) throw new Error(JSON.stringify(result));

    expect(result.changes).toEqual([
      "Contenido: Esencial x5: 5x Milanesa de pollo napolitana → Esencial x10: 4x Guiso de lentejas, 6x Milanesa de pollo napolitana; 1x Pollo preparado",
      "Día: Miércoles 04/11 → Miércoles 11/11",
      "Franja: 12:00 a 14:00 → 18:00 a 20:00",
      "Total: $21.500 → $49.500",
    ]);

    const detail = await getOrderDetail(db, order.id);
    expect(detail).toMatchObject({
      scheduledDate: "2026-11-11",
      scheduledTimeSlot: "18:00 a 20:00",
      subtotalCents: 4_950_000,
      totalCents: 4_950_000,
    });
    expect(detail?.items).toHaveLength(2);
    expect(await db.select().from(orderItems).where(eq(orderItems.orderId, order.id))).toHaveLength(
      2,
    );
    expect(detail?.changes[0]).toMatchObject({ kind: "EDICION", actor: "Ana" });
    expect(detail?.changes[0]?.note).toContain("Total: $21.500 → $49.500");
  });

  it("una edición sin cambios no ensucia el historial", async () => {
    const order = await newWebOrder({}, "+54 9 11 5555 0041");
    const result = await updateOrder(db, {
      orderId: order.id,
      input: adminInput({}, "+54 9 11 5555 0041"),
      actorId: adminId,
      ...deps,
    });
    expect(result).toMatchObject({ ok: true, changes: [] });
    expect(
      await db.select().from(orderChanges).where(eq(orderChanges.orderId, order.id)),
    ).toHaveLength(1);
  });

  it("la administración puede mover el pedido a un día que ya cerró para los clientes", async () => {
    const order = await newWebOrder({}, "+54 9 11 5555 0042");
    const lunes1201 = new Date("2026-11-02T12:01:00-03:00");
    const result = await updateOrder(db, {
      orderId: order.id,
      input: adminInput({}, "+54 9 11 5555 0042"),
      actorId: adminId,
      now: lunes1201,
      distanceFor: async () => null,
    });
    expect(result.ok).toBe(true);
  });

  it("fija el costo de envío a mano y lo registra", async () => {
    const order = await newWebOrder(
      {
        deliveryType: "DELIVERY",
        address: { street: "Alsina", number: "456", neighborhood: "Centro" },
      },
      "+54 9 11 5555 0043",
    );
    const input = adminInput(
      {
        deliveryType: "DELIVERY",
        address: { street: "Alsina", number: "456", neighborhood: "Centro" },
        deliveryFeeCents: 320_000,
      },
      "+54 9 11 5555 0043",
    );
    const result = await updateOrder(db, { orderId: order.id, input, actorId: adminId, ...deps });
    if (!result.ok) throw new Error(JSON.stringify(result));
    expect(result.changes).toEqual(["Envío: a confirmar → $3.200", "Total: $21.500 → $24.700"]);

    const detail = await getOrderDetail(db, order.id);
    expect(detail).toMatchObject({
      deliveryFeeCents: 320_000,
      deliveryFeeStatus: "CALCULADO",
      totalCents: 2_470_000,
    });
  });

  it("solo se edita hasta confirmar", async () => {
    const order = await newWebOrder({}, "+54 9 11 5555 0044");
    await changeOrderStatus(db, {
      orderId: order.id,
      to: "CONFIRMADO",
      role: "ADMIN",
      actorId: adminId,
      now: TEST_NOW,
    });
    expect(
      await updateOrder(db, {
        orderId: order.id,
        input: adminInput({}, "+54 9 11 5555 0044"),
        actorId: adminId,
        ...deps,
      }),
    ).toEqual({
      ok: false,
      code: "NOT_EDITABLE",
    });
  });

  it("un pedido inválido no cambia nada", async () => {
    const order = await newWebOrder({}, "+54 9 11 5555 0045");
    const incompleto = adminInput(
      {
        cart: {
          packs: [
            {
              id: "a",
              category: "ESENCIAL",
              size: 5,
              items: [{ productId: id("ESE-001"), quantity: 4 }],
            },
          ],
          complements: [],
        },
      },
      "+54 9 11 5555 0045",
    );
    const result = await updateOrder(db, {
      orderId: order.id,
      input: incompleto,
      actorId: adminId,
      ...deps,
    });
    expect(result).toMatchObject({ ok: false, code: "INVALID_ORDER" });

    const detail = await getOrderDetail(db, order.id);
    expect(detail?.totalCents).toBe(2_150_000);
    expect(detail?.items[0]?.details[0]?.quantity).toBe(5);
  });

  it("cambiar el teléfono reasigna el cliente", async () => {
    const order = await newWebOrder({}, "+54 9 11 5555 0046");
    const result = await updateOrder(db, {
      orderId: order.id,
      input: adminInput({ customer: { name: "Lucía Romero", phone: "11 5555 0099", email: "" } }),
      actorId: adminId,
      ...deps,
    });
    expect(result.ok && result.changes).toEqual(["Teléfono: +5491155550046 → +5491155550099"]);

    const [row] = await db.select().from(orders).where(eq(orders.id, order.id));
    const [customer] = await db.select().from(customers).where(eq(customers.id, row!.customerId!));
    expect(customer?.phone).toBe("+5491155550099");
  });

  it("un pedido inexistente da NOT_FOUND", async () => {
    expect(
      await updateOrder(db, {
        orderId: "00000000-0000-4000-8000-000000000000",
        input: adminInput(),
        actorId: adminId,
        ...deps,
      }),
    ).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
  });
});

describe("alta manual", () => {
  it("entra en PENDIENTE_CONFIRMACION con origen MANUAL, sin términos web y con historial", async () => {
    const result = await createManualOrder(db, {
      input: adminInput(
        {
          customer: { name: "Diego Ferrari", phone: "11 5555 0050", email: "diego@example.com" },
          paymentMethod: "EFECTIVO",
        },
        "11 5555 0050",
      ),
      actorId: adminId,
      ...deps,
    });
    if (!result.ok) throw new Error(JSON.stringify(result));

    const [row] = await db.select().from(orders).where(eq(orders.id, result.order.id));
    expect(row).toMatchObject({
      origin: "MANUAL",
      status: "PENDIENTE_CONFIRMACION",
      customerPhone: "+5491155550050",
      paymentMethod: "EFECTIVO",
      paymentStatus: "PENDIENTE",
      total: "21500.00",
    });
    expect(row?.termsAcceptedAt).toBeNull();

    const detail = await getOrderDetail(db, result.order.id);
    expect(detail?.changes[0]).toMatchObject({
      kind: "ESTADO",
      actor: "Ana",
      note: "Pedido cargado manualmente",
    });
  });

  it("no pisa el consentimiento comercial de un cliente que ya existía", async () => {
    await newWebOrder({ consentCommercial: true }, "+54 9 11 5555 0051");
    await createManualOrder(db, {
      input: adminInput({}, "+54 9 11 5555 0051"),
      actorId: adminId,
      ...deps,
    });
    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.phone, "+5491155550051"));
    expect(customer?.consentCommercial).toBe(true);
  });

  it("valida igual que la tienda y no guarda nada si falla", async () => {
    const before = (await listOrders(db)).total;
    const result = await createManualOrder(db, {
      input: adminInput({
        cart: { packs: [], complements: [{ productId: id("COM-001"), quantity: 1 }] },
      }),
      actorId: adminId,
      ...deps,
    });
    expect(result).toMatchObject({ ok: false, code: "INVALID_ORDER" });
    expect((await listOrders(db)).total).toBe(before);
  });
});
