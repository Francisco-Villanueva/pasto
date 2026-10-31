import { describe, expect, it } from "vitest";
import type { Cart, CartPack } from "./cart";
import { buildOrderDraft, type DraftContext, type DraftInput } from "./order-draft";
import { SAMPLE_SHIPPING, sampleCatalog, samplePrices } from "./sample-catalog";
import { generateDeliveryDays } from "./schedule";

const SLOT = "12:00 a 14:00";
const NOW = new Date("2026-10-28T10:00:00-03:00"); // miércoles; el próximo día abierto es el 04/11

const esencial10: CartPack = {
  id: "a",
  category: "ESENCIAL",
  size: 10,
  items: [
    { productId: "ESE-001", quantity: 6 },
    { productId: "ESE-003", quantity: 4 },
  ],
};
const burrito6: CartPack = {
  id: "b",
  category: "BURRITO",
  size: 6,
  items: [{ productId: "BUR-001", quantity: 6 }],
};

function context(overrides: Partial<DraftContext> = {}): DraftContext {
  return {
    catalog: sampleCatalog(),
    prices: samplePrices(),
    days: generateDeliveryDays(NOW, { weeks: 3, defaultSlots: [SLOT, "18:00 a 20:00"] }),
    now: NOW,
    shipping: { maxDistanceM: SAMPLE_SHIPPING.maxDistanceM, tiers: SAMPLE_SHIPPING.tiers },
    distanceM: 2_400,
    ...overrides,
  };
}

function input(overrides: Partial<DraftInput> = {}, cart?: Cart): DraftInput {
  return {
    cart: cart ?? {
      packs: [esencial10, burrito6],
      complements: [{ productId: "COM-001", quantity: 1 }],
    },
    deliveryType: "DELIVERY",
    hasAddress: true,
    scheduledDate: "2026-11-04",
    timeSlot: SLOT,
    ...overrides,
  };
}

function codes(result: ReturnType<typeof buildOrderDraft>): string[] {
  return result.ok ? [] : result.errors.map((e) => e.code);
}

describe("buildOrderDraft: pedido válido", () => {
  it("recalcula subtotal, envío y total con los precios vigentes", () => {
    const result = buildOrderDraft(input(), context());
    if (!result.ok) throw new Error(JSON.stringify(result.errors));

    expect(result.draft.subtotalCents).toBe(4_000_000 + 1_800_000 + 950_000);
    expect(result.draft.deliveryFeeCents).toBe(150_000); // 2,4 km → primer tramo
    expect(result.draft.deliveryFeeStatus).toBe("CALCULADO");
    expect(result.draft.deliveryDistanceM).toBe(2_400);
    expect(result.draft.totalCents).toBe(6_750_000 + 150_000);
  });

  it("separa packs, burritos y complementos, con el detalle por plato", () => {
    const result = buildOrderDraft(input(), context());
    if (!result.ok) throw new Error("esperaba ok");

    expect(result.draft.items.map((i) => [i.itemType, i.tierSize, i.category])).toEqual([
      ["PACK", 10, "ESENCIAL"],
      ["BURRITO_PACK", 6, "BURRITO"],
      ["COMPLEMENTO", null, "COMPLEMENTO"],
    ]);
    expect(result.draft.items[0]?.details).toEqual([
      {
        productId: "ESE-001",
        productName: "Milanesa de pollo napolitana",
        recipeVersion: "v1.0",
        quantity: 6,
      },
      {
        productId: "ESE-003",
        productName: "Guiso de lentejas",
        recipeVersion: "v1.0",
        quantity: 4,
      },
    ]);
  });

  it("un complemento se cobra por cantidad de packs", () => {
    const result = buildOrderDraft(
      input({}, { packs: [burrito6], complements: [{ productId: "COM-001", quantity: 3 }] }),
      context(),
    );
    if (!result.ok) throw new Error("esperaba ok");
    const complemento = result.draft.items.at(-1)!;
    expect(complemento.unitPriceCents).toBe(950_000);
    expect(complemento.totalPriceCents).toBe(2_850_000);
    expect(complemento.details[0]?.quantity).toBe(3);
  });

  it("retiro no cobra envío ni guarda distancia", () => {
    const result = buildOrderDraft(
      input({ deliveryType: "RETIRO", hasAddress: false }),
      context({ distanceM: 9_000 }),
    );
    if (!result.ok) throw new Error("esperaba ok");
    expect(result.draft.deliveryFeeCents).toBe(0);
    expect(result.draft.deliveryFeeStatus).toBe("NO_APLICA");
    expect(result.draft.deliveryDistanceM).toBeNull();
    expect(result.draft.totalCents).toBe(result.draft.subtotalCents);
  });

  it("si no se pudo ubicar la dirección, el envío queda a confirmar y el total no lo incluye", () => {
    const result = buildOrderDraft(input(), context({ distanceM: null }));
    if (!result.ok) throw new Error("esperaba ok");
    expect(result.draft.deliveryFeeCents).toBeNull();
    expect(result.draft.deliveryFeeStatus).toBe("A_CONFIRMAR");
    expect(result.draft.totalCents).toBe(result.draft.subtotalCents);
  });
});

describe("buildOrderDraft: rechazos", () => {
  it("rechaza un pack incompleto, planes mezclados y complementos huérfanos", () => {
    const incompleto = { ...esencial10, items: [{ productId: "ESE-001", quantity: 9 }] };
    expect(
      codes(buildOrderDraft(input({}, { packs: [incompleto], complements: [] }), context())),
    ).toEqual(["CART_INVALID"]);

    const proteico: CartPack = {
      id: "p",
      category: "PROTEICO",
      size: 5,
      items: [{ productId: "PRO-001", quantity: 5 }],
    };
    expect(
      codes(
        buildOrderDraft(input({}, { packs: [esencial10, proteico], complements: [] }), context()),
      ),
    ).toContain("CART_INVALID");

    expect(
      codes(
        buildOrderDraft(
          input({}, { packs: [], complements: [{ productId: "COM-001", quantity: 1 }] }),
          context(),
        ),
      ),
    ).toContain("CART_INVALID");
  });

  it("rechaza un carrito vacío", () => {
    expect(codes(buildOrderDraft(input({}, { packs: [], complements: [] }), context()))).toContain(
      "CART_INVALID",
    );
  });

  it("rechaza platos inactivos o que ya no existen", () => {
    const catalog = new Map(sampleCatalog());
    catalog.set("ESE-001", { ...catalog.get("ESE-001")!, isActive: false });
    expect(codes(buildOrderDraft(input(), context({ catalog })))).toContain("CART_INVALID");
  });

  it("rechaza un precio que falta en lugar de cobrar cero", () => {
    const result = buildOrderDraft(
      input({}, { packs: [burrito6], complements: [] }),
      context({ prices: new Map() }),
    );
    expect(result.ok ? null : result.errors).toEqual([
      { code: "PRICE_MISSING", keys: ["BURRITO:6"] },
    ]);
  });

  it("criterio 4: el miércoles ya no se acepta después del lunes a las 12:00", () => {
    const lunes1159 = new Date("2026-11-02T11:59:00-03:00");
    const lunes1201 = new Date("2026-11-02T12:01:00-03:00");
    expect(buildOrderDraft(input(), context({ now: lunes1159 })).ok).toBe(true);
    expect(codes(buildOrderDraft(input(), context({ now: lunes1201 })))).toEqual([
      "DAY_UNAVAILABLE",
    ]);
  });

  it("rechaza un día que no está en la agenda o está cerrado (viernes por defecto)", () => {
    expect(codes(buildOrderDraft(input({ scheduledDate: "2026-11-06" }), context()))).toEqual([
      "DAY_UNAVAILABLE",
    ]);
    expect(codes(buildOrderDraft(input({ scheduledDate: "2026-11-05" }), context()))).toEqual([
      "DAY_UNAVAILABLE",
    ]);
  });

  it("rechaza una franja que no es del día", () => {
    expect(codes(buildOrderDraft(input({ timeSlot: "03:00 a 04:00" }), context()))).toEqual([
      "SLOT_INVALID",
    ]);
  });

  it("envío sin dirección y fuera de radio", () => {
    expect(codes(buildOrderDraft(input({ hasAddress: false }), context()))).toEqual([
      "ADDRESS_REQUIRED",
    ]);
    expect(codes(buildOrderDraft(input(), context({ distanceM: 10_001 })))).toEqual([
      "OUT_OF_RANGE",
    ]);
  });

  it("junta todos los errores en una sola respuesta", () => {
    const result = buildOrderDraft(
      input(
        { scheduledDate: "2026-11-05", timeSlot: "x", hasAddress: false },
        { packs: [], complements: [] },
      ),
      context({ distanceM: 20_000 }),
    );
    expect(codes(result).sort()).toEqual([
      "ADDRESS_REQUIRED",
      "CART_INVALID",
      "DAY_UNAVAILABLE",
      "OUT_OF_RANGE",
    ]);
  });
});

describe("buildOrderDraft: administración", () => {
  const lunes1201 = new Date("2026-11-02T12:01:00-03:00"); // ya cerró el miércoles 04/11

  it("el cliente no puede pedir después del corte, pero la administración sí (el día tiene que seguir en la agenda)", () => {
    const base = input({ deliveryType: "RETIRO", hasAddress: false });
    expect(codes(buildOrderDraft(base, context({ now: lunes1201 })))).toEqual(["DAY_UNAVAILABLE"]);
    expect(buildOrderDraft(base, context({ now: lunes1201, adminOverride: true })).ok).toBe(true);
  });

  it("la administración puede usar un día cerrado, como un viernes que no se abrió", () => {
    const base = input({ scheduledDate: "2026-11-06", deliveryType: "RETIRO", hasAddress: false });
    expect(codes(buildOrderDraft(base, context()))).toEqual(["DAY_UNAVAILABLE"]);
    expect(buildOrderDraft(base, context({ adminOverride: true })).ok).toBe(true);
  });

  it("ni la administración puede usar un día pasado, uno fuera de la agenda ni una franja inexistente", () => {
    const retiro = { deliveryType: "RETIRO" as const, hasAddress: false };
    const pasado = new Date("2026-11-05T09:00:00-03:00");
    expect(
      codes(buildOrderDraft(input(retiro), context({ now: pasado, adminOverride: true }))),
    ).toEqual(["DAY_UNAVAILABLE"]);
    expect(
      codes(
        buildOrderDraft(
          input({ ...retiro, scheduledDate: "2026-11-05" }),
          context({ adminOverride: true }),
        ),
      ),
    ).toEqual(["DAY_UNAVAILABLE"]);
    expect(
      codes(
        buildOrderDraft(
          input({ ...retiro, timeSlot: "03:00 a 04:00" }),
          context({ adminOverride: true }),
        ),
      ),
    ).toEqual(["SLOT_INVALID"]);
  });

  it("un costo de envío manual reemplaza al cálculo por distancia", () => {
    const result = buildOrderDraft(input({ deliveryFeeOverrideCents: 320_000 }), context());
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
    expect(result.draft.deliveryFeeCents).toBe(320_000);
    expect(result.draft.deliveryFeeStatus).toBe("CALCULADO");
    expect(result.draft.deliveryDistanceM).toBeNull();
    expect(result.draft.totalCents).toBe(result.draft.subtotalCents + 320_000);
  });

  it("el costo manual resuelve un envío 'a confirmar' y también vale fuera del radio", () => {
    expect(
      buildOrderDraft(input({ deliveryFeeOverrideCents: 100_000 }), context({ distanceM: null }))
        .ok,
    ).toBe(true);
    const fuera = buildOrderDraft(
      input({ deliveryFeeOverrideCents: 900_000 }),
      context({ distanceM: 15_000 }),
    );
    expect(fuera.ok).toBe(true);
  });

  it("un costo manual en $0 es un envío gratis, no 'a confirmar'", () => {
    const result = buildOrderDraft(
      input({ deliveryFeeOverrideCents: 0 }),
      context({ distanceM: null }),
    );
    if (!result.ok) throw new Error("esperaba ok");
    expect(result.draft.deliveryFeeCents).toBe(0);
    expect(result.draft.deliveryFeeStatus).toBe("CALCULADO");
  });

  it("en retiro se ignora el costo manual", () => {
    const result = buildOrderDraft(
      input({ deliveryType: "RETIRO", hasAddress: false, deliveryFeeOverrideCents: 500_000 }),
      context(),
    );
    if (!result.ok) throw new Error("esperaba ok");
    expect(result.draft.deliveryFeeCents).toBe(0);
    expect(result.draft.deliveryFeeStatus).toBe("NO_APLICA");
  });
});
