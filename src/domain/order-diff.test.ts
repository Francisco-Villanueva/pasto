import { describe, expect, it } from "vitest";
import { describeEdit, formatAddress, itemLabels, type OrderSnapshot } from "./order-diff";

const base: OrderSnapshot = {
  scheduledDate: "2026-11-04",
  timeSlot: "12:00 a 14:00",
  deliveryType: "DELIVERY",
  address: "Alsina 456, Centro",
  items: ["Esencial x5: 5x Milanesa de pollo napolitana"],
  subtotalCents: 2_150_000,
  deliveryFeeCents: 150_000,
  totalCents: 2_300_000,
  customerName: "Lucía Romero",
  customerPhone: "+5492915550123",
};

describe("itemLabels", () => {
  it("describe packs con su detalle y complementos por cantidad", () => {
    expect(
      itemLabels([
        {
          category: "ESENCIAL",
          tierSize: 10,
          details: [
            { quantity: 6, productName: "Milanesa" },
            { quantity: 4, productName: "Guiso" },
          ],
        },
        { category: "BURRITO", tierSize: 6, details: [{ quantity: 6, productName: "Burrito" }] },
        {
          category: "COMPLEMENTO",
          tierSize: null,
          details: [{ quantity: 2, productName: "Pollo preparado" }],
        },
      ]),
    ).toEqual([
      "Esencial x10: 4x Guiso, 6x Milanesa",
      "Burritos x6: 6x Burrito",
      "2x Pollo preparado",
    ]);
  });
});

describe("formatAddress", () => {
  it("arma la dirección con piso y referencia, y admite no tener", () => {
    expect(
      formatAddress({
        street: "Alsina",
        number: "456",
        floorApt: "4B",
        neighborhood: "Centro",
        notes: "Timbre 2",
      }),
    ).toBe("Alsina 456 4B, Centro (Ref: Timbre 2)");
    expect(formatAddress({ street: "Alsina", number: "456", neighborhood: "Centro" })).toBe(
      "Alsina 456, Centro",
    );
    expect(formatAddress(null)).toBeNull();
  });
});

describe("describeEdit", () => {
  it("sin cambios no devuelve nada", () => {
    expect(describeEdit(base, { ...base })).toEqual([]);
  });

  it("dice qué cambió, campo por campo, en español", () => {
    const lines = describeEdit(base, {
      ...base,
      scheduledDate: "2026-11-11",
      timeSlot: "18:00 a 20:00",
      items: ["Esencial x10: 10x Milanesa de pollo napolitana"],
      subtotalCents: 4_000_000,
      totalCents: 4_150_000,
    });
    expect(lines).toEqual([
      "Contenido: Esencial x5: 5x Milanesa de pollo napolitana → Esencial x10: 10x Milanesa de pollo napolitana",
      "Día: Miércoles 04/11 → Miércoles 11/11",
      "Franja: 12:00 a 14:00 → 18:00 a 20:00",
      "Total: $23.000 → $41.500",
    ]);
  });

  it("cubre entrega, dirección, cliente, teléfono y envío a confirmar", () => {
    const lines = describeEdit(base, {
      ...base,
      deliveryType: "RETIRO",
      address: null,
      deliveryFeeCents: null,
      customerName: "Lucía R.",
      customerPhone: "+5491155550000",
    });
    expect(lines).toEqual([
      "Entrega: Envío → Retiro",
      "Dirección: Alsina 456, Centro → sin dirección",
      "Cliente: Lucía Romero → Lucía R.",
      "Teléfono: +5492915550123 → +5491155550000",
      "Envío: $1.500 → a confirmar",
    ]);
  });
});

describe("itemLabels: orden estable", () => {
  it("da el mismo resultado sin importar el orden en que lleguen los packs y los platos", () => {
    const esencial = {
      category: "ESENCIAL" as const,
      tierSize: 10,
      details: [
        { quantity: 4, productName: "Guiso" },
        { quantity: 6, productName: "Milanesa" },
      ],
    };
    const burrito = {
      category: "BURRITO" as const,
      tierSize: 6,
      details: [{ quantity: 6, productName: "Burrito" }],
    };
    const complemento = {
      category: "COMPLEMENTO" as const,
      tierSize: null,
      details: [{ quantity: 1, productName: "Pollo" }],
    };

    const a = itemLabels([complemento, burrito, esencial]);
    const b = itemLabels(
      [esencial, { ...burrito }, { ...complemento }].map((item) => ({
        ...item,
        details: [...item.details].reverse(),
      })),
    );
    expect(a).toEqual(b);
    expect(a.at(-1)).toBe("1x Pollo");
  });

  it("dos packs del mismo plan se ordenan por tamaño", () => {
    const pack = (size: number) => ({
      category: "ESENCIAL" as const,
      tierSize: size,
      details: [{ quantity: size, productName: "Milanesa" }],
    });
    expect(itemLabels([pack(10), pack(5)])).toEqual([
      "Esencial x5: 5x Milanesa",
      "Esencial x10: 10x Milanesa",
    ]);
  });
});
