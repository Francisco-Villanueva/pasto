import { describe, expect, it } from "vitest";
import { checkoutSchema, fieldErrors } from "./checkout-schema";

const valid = {
  cart: {
    packs: [
      { id: "a", category: "ESENCIAL", size: 5, items: [{ productId: "ESE-001", quantity: 5 }] },
    ],
    complements: [],
  },
  deliveryType: "DELIVERY",
  address: { street: "Alsina", number: "456", neighborhood: "Centro" },
  scheduledDate: "2026-11-04",
  timeSlot: "12:00 a 14:00",
  customer: { name: "Lucía Romero", phone: "+54 9 291 555 0123", email: "" },
  consentCommercial: false,
  acceptTerms: true,
};

describe("checkoutSchema", () => {
  it("acepta un pedido completo", () => {
    expect(checkoutSchema.safeParse(valid).success).toBe(true);
  });

  it("acepta retiro sin dirección", () => {
    const result = checkoutSchema.safeParse({
      ...valid,
      deliveryType: "RETIRO",
      address: undefined,
    });
    expect(result.success).toBe(true);
  });

  it("exige la dirección cuando es envío", () => {
    const result = checkoutSchema.safeParse({ ...valid, address: undefined });
    expect(result.success ? {} : fieldErrors(result.error)).toEqual({
      address: "Completá la dirección de entrega.",
    });
  });

  it("exige aceptar los términos", () => {
    const result = checkoutSchema.safeParse({ ...valid, acceptTerms: false });
    expect(result.success ? {} : fieldErrors(result.error)).toEqual({
      acceptTerms: "Para pedir tenés que aceptar los términos.",
    });
  });

  it("valida nombre, WhatsApp y email con mensajes por campo", () => {
    const result = checkoutSchema.safeParse({
      ...valid,
      customer: { name: "A", phone: "123", email: "no-es-email" },
    });
    expect(result.success ? {} : fieldErrors(result.error)).toEqual({
      "customer.name": "Escribí tu nombre y apellido.",
      "customer.phone": "Revisá el número: tiene que ser un celular con código de área.",
      "customer.email": "Revisá el email.",
    });
  });

  it("no tiene lugar para precios: un campo extra no cambia nada de lo que el servidor calcula", () => {
    const result = checkoutSchema.safeParse({ ...valid, total: 1, deliveryFee: 0, subtotal: 1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data)).not.toContain("total");
      expect(Object.keys(result.data)).not.toContain("deliveryFee");
    }
  });

  it("rechaza fechas con formato inválido y carritos dañados", () => {
    expect(checkoutSchema.safeParse({ ...valid, scheduledDate: "04/11/2026" }).success).toBe(false);
    expect(
      checkoutSchema.safeParse({ ...valid, cart: { packs: "x", complements: [] } }).success,
    ).toBe(false);
  });
});
