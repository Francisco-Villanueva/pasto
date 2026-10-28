import { describe, expect, it } from "vitest";
import { buildOrderMessage, buildWhatsappUrl, type WhatsappOrder } from "./whatsapp";

const base: WhatsappOrder = {
  orderNumber: "PAS-000101",
  items: [
    {
      category: "ESENCIAL",
      tierSize: 10,
      details: [
        { quantity: 6, productName: "Milanesa de pollo napolitana" },
        { quantity: 4, productName: "Guiso de lentejas" },
      ],
    },
    {
      category: "BURRITO",
      tierSize: 6,
      details: [{ quantity: 6, productName: "Burrito de carne y cheddar" }],
    },
  ],
  complements: [{ quantity: 1, productName: "Pollo preparado" }],
  deliveryDayLabel: "Miércoles 04/11",
  timeSlot: "12:00 a 14:00",
  deliveryType: "DELIVERY",
  address: { street: "Av. Siempreviva", number: "742", neighborhood: "Centro", notes: "Timbre 2" },
  subtotalCents: 4_000_000 + 1_800_000 + 950_000,
  deliveryFeeCents: 250_000,
  customerName: "Ana Pérez",
  customerPhone: "+5491112345678",
};

describe("buildOrderMessage", () => {
  it("respeta la plantilla de la especificación", () => {
    expect(buildOrderMessage(base)).toBe(
      [
        "Hola, Pasto. Quiero solicitar el pedido PAS-000101.",
        "",
        "- Esencial x10: 6x Milanesa de pollo napolitana, 4x Guiso de lentejas",
        "- Burritos x6: 6x Burrito de carne y cheddar",
        "- Complemento: 1x Pollo preparado",
        "",
        "Entrega: Miércoles 04/11 - 12:00 a 14:00 (Envío)",
        "Dirección: Av. Siempreviva 742, Centro (Ref: Timbre 2)",
        "",
        "Subtotal: $67.500",
        "Envío: $2.500",
        "Total: $70.000",
        "",
        "Cliente: Ana Pérez",
        "Teléfono: +5491112345678",
        "",
        "Entiendo que el pedido queda sujeto a confirmación de Pasto.",
      ].join("\n"),
    );
  });

  it("en retiro no incluye dirección y el envío es $0", () => {
    const text = buildOrderMessage({
      ...base,
      deliveryType: "RETIRO",
      address: undefined,
      deliveryFeeCents: 0,
    });
    expect(text).toContain("Entrega: Miércoles 04/11 - 12:00 a 14:00 (Retiro)");
    expect(text).not.toContain("Dirección:");
    expect(text).toContain("Envío: $0");
    expect(text).toContain("Total: $67.500");
  });

  it("si el envío queda a confirmar, lo dice y no inventa un total", () => {
    const text = buildOrderMessage({ ...base, deliveryFeeCents: null });
    expect(text).toContain("Envío: a confirmar");
    expect(text).toContain("Total: $67.500 + envío a confirmar");
  });

  it("omite la referencia si no hay notas", () => {
    const text = buildOrderMessage({
      ...base,
      address: { street: "Calle", number: "1", floorApt: "4B", neighborhood: "Norte" },
    });
    expect(text).toContain("Dirección: Calle 1 4B, Norte");
    expect(text).not.toContain("Ref:");
  });

  it("si el mensaje codificado es demasiado largo manda un resumen con el número de pedido", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      category: "ESENCIAL" as const,
      tierSize: 20,
      details: [
        { quantity: 20, productName: `Plato número ${i} con nombre largo y acentuado ñandú` },
      ],
    }));
    const text = buildOrderMessage({ ...base, items: many });
    expect(text).toContain("PAS-000101");
    expect(text).toContain("Son 40 packs y 1 complemento");
    expect(text).toContain("Cliente: Ana Pérez");
    expect(text).not.toContain("Plato número 0");
    expect(encodeURIComponent(text).length).toBeLessThan(1800);
  });
});

describe("buildWhatsappUrl", () => {
  it("usa solo dígitos en el teléfono y codifica el texto", () => {
    const url = buildWhatsappUrl("+54 9 11 1234-5678", "Hola, Pasto.\nQuiero ñoquis");
    expect(url).toBe("https://wa.me/5491112345678?text=Hola%2C%20Pasto.%0AQuiero%20%C3%B1oquis");
  });
});
