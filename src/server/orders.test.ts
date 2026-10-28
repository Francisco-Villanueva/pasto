import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import {
  customers,
  deliveryDays,
  orderChanges,
  orderItemDetails,
  orderItems,
  orders,
  packPricingTiers,
  products,
  settings,
} from "@/db/schema";
import type { AppDb } from "@/db/types";
import type { CheckoutInput } from "@/lib/checkout-schema";
import { getOrderConfirmation } from "./order-view";
import { createPreliminaryOrder, MAX_ORDERS_PER_PHONE_PER_HOUR } from "./orders";
import { createTestDb, productIds, TEST_NOW } from "./test-db";

let db: AppDb;
let id: (sku: string) => string;

beforeAll(async () => {
  db = await createTestDb();
  id = await productIds(db);
});

function checkout(
  overrides: Partial<CheckoutInput> = {},
  phone = "+54 9 291 555 0123",
): CheckoutInput {
  return {
    cart: {
      packs: [
        {
          id: "p1",
          category: "ESENCIAL",
          size: 10,
          items: [
            { productId: id("ESE-001"), quantity: 6 },
            { productId: id("ESE-003"), quantity: 4 },
          ],
        },
        {
          id: "p2",
          category: "BURRITO",
          size: 6,
          items: [{ productId: id("BUR-001"), quantity: 6 }],
        },
      ],
      complements: [{ productId: id("COM-001"), quantity: 1 }],
    },
    deliveryType: "DELIVERY",
    address: { street: "Alsina", number: "456", neighborhood: "Centro", notes: "Timbre 2B" },
    placeId: "place-1",
    scheduledDate: "2026-11-04",
    timeSlot: "12:00 a 14:00",
    customer: { name: "Lucía Romero", phone, email: "lucia@example.com" },
    consentCommercial: true,
    acceptTerms: true,
    ...overrides,
  };
}

const deps = (distanceM: number | null = 2_400) => ({
  now: TEST_NOW,
  distanceFor: async () => distanceM,
});

async function orderCount(): Promise<number> {
  return (await db.select().from(orders)).length;
}

describe("createPreliminaryOrder: pedido válido", () => {
  it("guarda el pedido PRELIMINAR con importes calculados por el servidor", async () => {
    const result = await createPreliminaryOrder(db, checkout(), deps());
    if (!result.ok) throw new Error(JSON.stringify(result));

    expect(result.order.orderNumber).toBe("PAS-000101");

    const [order] = await db.select().from(orders).where(eq(orders.id, result.order.id));
    expect(order).toMatchObject({
      status: "PRELIMINAR",
      origin: "WEB",
      customerName: "Lucía Romero",
      customerPhone: "+5492915550123", // normalizado
      deliveryType: "DELIVERY",
      deliveryDistanceM: 2_400,
      deliveryFeeStatus: "CALCULADO",
      scheduledDate: "2026-11-04",
      subtotal: "67500.00",
      deliveryFee: "1500.00",
      total: "69000.00",
      paymentStatus: "PENDIENTE",
    });
    expect(order?.termsAcceptedAt).toEqual(TEST_NOW);
    expect(order?.deliveryAddress).toMatchObject({ street: "Alsina", notes: "Timbre 2B" });
  });

  it("guarda packs, burritos y complementos con su detalle por plato", async () => {
    const [order] = await db.select().from(orders).where(eq(orders.orderNumber, "PAS-000101"));
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order!.id));
    expect(items.map((i) => [i.itemType, i.tierSize, i.totalPrice]).sort()).toEqual([
      ["BURRITO_PACK", 6, "18000.00"],
      ["COMPLEMENTO", null, "9500.00"],
      ["PACK", 10, "40000.00"],
    ]);

    const pack = items.find((i) => i.itemType === "PACK")!;
    const details = await db
      .select()
      .from(orderItemDetails)
      .where(eq(orderItemDetails.orderItemId, pack.id));
    expect(details.map((d) => [d.productName, d.quantity, d.recipeVersion]).sort()).toEqual([
      ["Guiso de lentejas", 4, "v1.0"],
      ["Milanesa de pollo napolitana", 6, "v1.0"],
    ]);
  });

  it("registra la creación en el historial y el cliente con su consentimiento", async () => {
    const [order] = await db.select().from(orders).where(eq(orders.orderNumber, "PAS-000101"));
    const history = await db.select().from(orderChanges).where(eq(orderChanges.orderId, order!.id));
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      kind: "ESTADO",
      note: "Pedido creado desde la web",
      changedBy: null,
    });

    const [customer] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, order!.customerId!));
    expect(customer).toMatchObject({
      fullName: "Lucía Romero",
      phone: "+5492915550123",
      email: "lucia@example.com",
      consentCommercial: true,
    });
  });

  it("devuelve el mensaje de WhatsApp con el formato de la especificación", async () => {
    const result = await createPreliminaryOrder(db, checkout({}, "+54 9 11 5555 0001"), deps());
    if (!result.ok) throw new Error("esperaba ok");

    expect(result.message).toBe(
      [
        `Hola, Pasto. Quiero solicitar el pedido ${result.order.orderNumber}.`,
        "",
        "- Esencial x10: 6x Milanesa de pollo napolitana, 4x Guiso de lentejas",
        "- Burritos x6: 6x Burrito de carne y cheddar",
        "- Complemento: 1x Pollo preparado",
        "",
        "Entrega: Miércoles 04/11 - 12:00 a 14:00 (Envío)",
        "Dirección: Alsina 456, Centro (Ref: Timbre 2B)",
        "",
        "Subtotal: $67.500",
        "Envío: $1.500",
        "Total: $69.000",
        "",
        "Cliente: Lucía Romero",
        "Teléfono: +5491155550001",
        "",
        "Entiendo que el pedido queda sujeto a confirmación de Pasto.",
      ].join("\n"),
    );
    expect(result.whatsappUrl.startsWith("https://wa.me/5492915550000?text=")).toBe(true);
    expect(decodeURIComponent(result.whatsappUrl.split("?text=")[1]!)).toBe(result.message);
  });

  it("usa los precios vigentes al momento de pedir, no los que vio el cliente", async () => {
    await db
      .update(packPricingTiers)
      .set({ price: "50000.00" })
      .where(eq(packPricingTiers.size, 10));
    try {
      const result = await createPreliminaryOrder(db, checkout({}, "+54 9 11 5555 0002"), deps());
      if (!result.ok) throw new Error("esperaba ok");
      const [order] = await db.select().from(orders).where(eq(orders.id, result.order.id));
      expect(order?.subtotal).toBe("77500.00"); // 50.000 + 18.000 + 9.500
    } finally {
      await db
        .update(packPricingTiers)
        .set({ price: "40000.00" })
        .where(eq(packPricingTiers.size, 10));
    }
  });
});

describe("createPreliminaryOrder: envío y retiro", () => {
  it("retiro: sin envío ni dirección guardada", async () => {
    const result = await createPreliminaryOrder(
      db,
      checkout(
        { deliveryType: "RETIRO", address: undefined, placeId: undefined },
        "+54 9 11 5555 0003",
      ),
      deps(),
    );
    if (!result.ok) throw new Error("esperaba ok");
    const [order] = await db.select().from(orders).where(eq(orders.id, result.order.id));
    expect(order).toMatchObject({
      deliveryType: "RETIRO",
      deliveryFeeStatus: "NO_APLICA",
      deliveryFee: "0.00",
      deliveryAddress: null,
      total: "67500.00",
    });
    expect(result.message).toContain("(Retiro)");
    expect(result.message).not.toContain("Dirección:");
  });

  it("si no se pudo medir la distancia, el envío queda a confirmar y no se bloquea el pedido", async () => {
    const result = await createPreliminaryOrder(db, checkout({}, "+54 9 11 5555 0004"), deps(null));
    if (!result.ok) throw new Error("esperaba ok");
    const [order] = await db.select().from(orders).where(eq(orders.id, result.order.id));
    expect(order).toMatchObject({
      deliveryFeeStatus: "A_CONFIRMAR",
      deliveryFee: null,
      total: "67500.00",
    });
    expect(result.message).toContain("Envío: a confirmar");
  });

  it("fuera del radio máximo no se crea el pedido", async () => {
    const before = await orderCount();
    const result = await createPreliminaryOrder(
      db,
      checkout({}, "+54 9 11 5555 0005"),
      deps(15_000),
    );
    expect(result).toMatchObject({ ok: false, code: "INVALID_ORDER" });
    expect(
      result.ok ? [] : (result as { errors: { code: string }[] }).errors.map((e) => e.code),
    ).toEqual(["OUT_OF_RANGE"]);
    expect(await orderCount()).toBe(before);
  });
});

describe("createPreliminaryOrder: rechazos (no guardan nada)", () => {
  async function rejected(input: CheckoutInput, extra = deps()) {
    const before = await orderCount();
    const result = await createPreliminaryOrder(db, input, extra);
    expect(await orderCount()).toBe(before);
    if (result.ok) throw new Error("esperaba un rechazo");
    return result;
  }

  it("pack incompleto, planes mezclados y complemento sin pack", async () => {
    const incompleto = checkout({}, "+54 9 11 5555 0006");
    incompleto.cart.packs[0]!.items = [{ productId: id("ESE-001"), quantity: 9 }];
    expect(await rejected(incompleto)).toMatchObject({ code: "INVALID_ORDER" });

    const mezclado = checkout({}, "+54 9 11 5555 0007");
    mezclado.cart.packs.push({
      id: "p3",
      category: "PROTEICO",
      size: 5,
      items: [{ productId: id("PRO-001"), quantity: 5 }],
    });
    expect(await rejected(mezclado)).toMatchObject({ code: "INVALID_ORDER" });

    const huerfano = checkout({}, "+54 9 11 5555 0008");
    huerfano.cart.packs = [];
    expect(await rejected(huerfano)).toMatchObject({ code: "INVALID_ORDER" });
  });

  it("un plato desactivado después de armar el carrito", async () => {
    await db.update(products).set({ isActive: false }).where(eq(products.sku, "ESE-003"));
    try {
      expect(await rejected(checkout({}, "+54 9 11 5555 0009"))).toMatchObject({
        code: "INVALID_ORDER",
      });
    } finally {
      await db.update(products).set({ isActive: true }).where(eq(products.sku, "ESE-003"));
    }
  });

  it("criterio 4: lunes 12:01 ya no se acepta el miércoles; 11:59 sí", async () => {
    const tarde = await rejected(checkout({}, "+54 9 11 5555 0010"), {
      now: new Date("2026-11-02T12:01:00-03:00"),
      distanceFor: async () => 2_400,
    });
    expect(tarde).toMatchObject({ code: "INVALID_ORDER" });
    expect((tarde as { errors: { code: string }[] }).errors.map((e) => e.code)).toEqual([
      "DAY_UNAVAILABLE",
    ]);

    const aTiempo = await createPreliminaryOrder(db, checkout({}, "+54 9 11 5555 0011"), {
      now: new Date("2026-11-02T11:59:00-03:00"),
      distanceFor: async () => 2_400,
    });
    expect(aTiempo.ok).toBe(true);
  });

  it("viernes cerrado, día inexistente y franja que no es del día", async () => {
    const codes = async (overrides: Partial<CheckoutInput>, phone: string) => {
      const result = await rejected(checkout(overrides, phone));
      return (result as { errors: { code: string }[] }).errors.map((e) => e.code);
    };
    expect(await codes({ scheduledDate: "2026-11-06" }, "+54 9 11 5555 0012")).toEqual([
      "DAY_UNAVAILABLE",
    ]);
    expect(await codes({ scheduledDate: "2026-11-05" }, "+54 9 11 5555 0013")).toEqual([
      "DAY_UNAVAILABLE",
    ]);
    expect(await codes({ timeSlot: "03:00 a 04:00" }, "+54 9 11 5555 0014")).toEqual([
      "SLOT_INVALID",
    ]);
  });

  it("un viernes que el admin abrió se puede pedir hasta el miércoles a las 12:00", async () => {
    await db.update(deliveryDays).set({ isOpen: true }).where(eq(deliveryDays.date, "2026-11-06"));
    const result = await createPreliminaryOrder(
      db,
      checkout({ scheduledDate: "2026-11-06" }, "+54 9 11 5555 0015"),
      deps(),
    );
    expect(result.ok).toBe(true);
  });

  it("el checkout queda deshabilitado si no hay WhatsApp configurado", async () => {
    const saved = (await db.select().from(settings).where(eq(settings.key, "pasto_whatsapp")))[0]!;
    await db.delete(settings).where(eq(settings.key, "pasto_whatsapp"));
    try {
      expect(await rejected(checkout({}, "+54 9 11 5555 0016"))).toMatchObject({
        code: "CHECKOUT_DISABLED",
      });
    } finally {
      await db.insert(settings).values(saved);
    }
  });
});

describe("createPreliminaryOrder: límite por teléfono", () => {
  it(`permite ${MAX_ORDERS_PER_PHONE_PER_HOUR} pedidos por hora y después frena, solo a ese teléfono`, async () => {
    const phone = "+54 9 11 5555 7777";
    for (let i = 0; i < MAX_ORDERS_PER_PHONE_PER_HOUR; i++) {
      const result = await createPreliminaryOrder(db, checkout({}, phone), deps());
      expect(result.ok).toBe(true);
    }

    const blocked = await createPreliminaryOrder(db, checkout({}, phone), deps());
    expect(blocked).toEqual({ ok: false, code: "RATE_LIMITED" });

    const otherPhone = await createPreliminaryOrder(db, checkout({}, "+54 9 11 5555 8888"), deps());
    expect(otherPhone.ok).toBe(true);

    const later = await createPreliminaryOrder(db, checkout({}, phone), {
      now: new Date(TEST_NOW.getTime() + 3_700_000),
      distanceFor: async () => 2_400,
    });
    expect(later.ok).toBe(true);
  });
});

describe("clientes", () => {
  it("un mismo teléfono es un solo cliente y se actualiza su consentimiento", async () => {
    const phone = "+54 9 11 5555 9999";
    await createPreliminaryOrder(db, checkout({ consentCommercial: true }, phone), deps());
    await createPreliminaryOrder(db, checkout({ consentCommercial: false }, phone), deps());

    const rows = await db.select().from(customers).where(eq(customers.phone, "+5491155559999"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.consentCommercial).toBe(false);
  });
});

describe("getOrderConfirmation", () => {
  it("devuelve el pedido por su token privado, con el mismo mensaje y enlace de WhatsApp", async () => {
    const created = await createPreliminaryOrder(db, checkout({}, "+54 9 11 5555 4444"), deps());
    if (!created.ok) throw new Error("esperaba ok");

    const confirmation = await getOrderConfirmation(db, created.order.accessToken);
    expect(confirmation).toMatchObject({
      orderNumber: created.order.orderNumber,
      status: "PRELIMINAR",
      deliveryDayLabel: "Miércoles 04/11",
      subtotalCents: 6_750_000,
      deliveryFeeCents: 150_000,
      totalCents: 6_900_000,
      lines: ["Esencial x10", "Burritos x6", "1x Pollo preparado"],
    });
    expect(confirmation?.message).toBe(created.message);
    expect(confirmation?.whatsappUrl).toBe(created.whatsappUrl);
  });

  it("no revela nada con el número de pedido ni con un token inválido o inexistente", async () => {
    expect(await getOrderConfirmation(db, "PAS-000101")).toBeNull();
    expect(await getOrderConfirmation(db, "no-es-un-token")).toBeNull();
    expect(await getOrderConfirmation(db, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});
