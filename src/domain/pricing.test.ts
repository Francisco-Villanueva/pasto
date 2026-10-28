import { describe, expect, it } from "vitest";
import type { Cart, CartPack } from "./cart";
import { priceCart } from "./pricing";
import { sampleCatalog, samplePrices } from "./sample-catalog";

const catalog = sampleCatalog();
const prices = samplePrices();

const pack = (id: string, size: number): CartPack => ({
  id,
  category: "ESENCIAL",
  size,
  items: [{ productId: "ESE-001", quantity: size }],
});

describe("priceCart", () => {
  it("cobra cada pack a su precio y suma complementos por cantidad", () => {
    const cart: Cart = {
      packs: [pack("a", 5), { ...pack("b", 6), category: "BURRITO" }],
      complements: [{ productId: "COM-001", quantity: 2 }],
    };
    const result = priceCart(cart, prices, catalog);
    if (!result.ok) throw new Error("esperaba ok");
    expect(result.subtotalCents).toBe(2_150_000 + 1_800_000 + 2 * 950_000);
  });

  it("NO agrupa por volumen: dos packs de 10 no pasan a precio de pack de 20", () => {
    const cart: Cart = { packs: [pack("a", 10), pack("b", 10)], complements: [] };
    const result = priceCart(cart, prices, catalog);
    if (!result.ok) throw new Error("esperaba ok");
    expect(result.subtotalCents).toBe(2 * 4_000_000);
    expect(result.subtotalCents).not.toBe(7_600_000);
  });

  it("informa los precios que faltan en lugar de inventar un total", () => {
    const cart: Cart = { packs: [pack("a", 5)], complements: [] };
    const result = priceCart(cart, new Map(), catalog);
    expect(result).toEqual({ ok: false, missingPrices: ["ESENCIAL:5"] });
  });

  it("un complemento sin precio cargado no se cobra en cero", () => {
    const sinPrecio = new Map(catalog);
    sinPrecio.set("COM-001", { ...catalog.get("COM-001")!, priceCents: undefined });
    const cart: Cart = {
      packs: [pack("a", 5)],
      complements: [{ productId: "COM-001", quantity: 1 }],
    };
    expect(priceCart(cart, prices, sinPrecio)).toEqual({
      ok: false,
      missingPrices: ["COMPLEMENTO:COM-001"],
    });
  });
});
