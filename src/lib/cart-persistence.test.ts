import { describe, expect, it } from "vitest";
import { EMPTY_CART } from "@/domain/cart";
import { cartCount, parseCart } from "./cart-persistence";

const valid = {
  packs: [
    {
      id: "a",
      category: "ESENCIAL",
      size: 5,
      items: [{ productId: "ESE-001", quantity: 5 }],
    },
  ],
  complements: [{ productId: "COM-001", quantity: 2 }],
};

describe("parseCart", () => {
  it("acepta un carrito guardado con el formato esperado", () => {
    expect(parseCart(valid)).toEqual(valid);
  });

  it("descarta lo que no tiene el formato esperado", () => {
    expect(parseCart(undefined)).toEqual(EMPTY_CART);
    expect(parseCart(null)).toEqual(EMPTY_CART);
    expect(parseCart("basura")).toEqual(EMPTY_CART);
    expect(parseCart({ packs: "x", complements: [] })).toEqual(EMPTY_CART);
  });

  it("descarta categorías, cantidades o tamaños inválidos", () => {
    expect(
      parseCart({ ...valid, packs: [{ ...valid.packs[0], category: "COMPLEMENTO" }] }),
    ).toEqual(EMPTY_CART);
    expect(parseCart({ ...valid, complements: [{ productId: "COM-001", quantity: -1 }] })).toEqual(
      EMPTY_CART,
    );
    expect(parseCart({ ...valid, packs: [{ ...valid.packs[0], size: 0 }] })).toEqual(EMPTY_CART);
  });
});

describe("cartCount", () => {
  it("cuenta packs y unidades de complementos", () => {
    expect(cartCount(parseCart(valid))).toBe(3);
    expect(cartCount(EMPTY_CART)).toBe(0);
  });
});
