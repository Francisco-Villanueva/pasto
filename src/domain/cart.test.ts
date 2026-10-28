import { describe, expect, it } from "vitest";
import {
  EMPTY_CART,
  addComplement,
  addPack,
  canCheckout,
  cartIssues,
  removeComplement,
  removePack,
  resolvePlanConflict,
  type Cart,
  type CartPack,
} from "./cart";
import { sampleCatalog } from "./sample-catalog";

const catalog = sampleCatalog();

const esencial5: CartPack = {
  id: "e5",
  category: "ESENCIAL",
  size: 5,
  items: [{ productId: "ESE-001", quantity: 5 }],
};
const proteico5: CartPack = {
  id: "p5",
  category: "PROTEICO",
  size: 5,
  items: [{ productId: "PRO-001", quantity: 5 }],
};
const burrito6: CartPack = {
  id: "b6",
  category: "BURRITO",
  size: 6,
  items: [{ productId: "BUR-001", quantity: 6 }],
};

function cartWith(...packs: CartPack[]): Cart {
  return { packs, complements: [] };
}

describe("plan incompatible", () => {
  it("con Esencial en el carrito, agregar Proteico pide confirmación y no cambia nada", () => {
    const cart = cartWith(esencial5);
    const result = addPack(cart, proteico5, catalog);
    expect(result).toEqual({ status: "plan_conflict", conflictingPackIds: ["e5"] });
    expect(cart.packs).toEqual([esencial5]);
  });

  it("permite varios packs del mismo plan", () => {
    const result = addPack(cartWith(esencial5), { ...esencial5, id: "e5b" }, catalog);
    expect(result.status).toBe("added");
  });

  it("burritos y complementos conviven con cualquier plan", () => {
    const withBurrito = addPack(cartWith(esencial5), burrito6, catalog);
    expect(withBurrito.status).toBe("added");
    const withProteico = addPack(cartWith(proteico5), burrito6, catalog);
    expect(withProteico.status).toBe("added");
  });

  it("'mantener' deja el carrito como estaba", () => {
    const cart = cartWith(esencial5);
    expect(resolvePlanConflict(cart, proteico5, "keep")).toBe(cart);
  });

  it("'reemplazar' quita solo el plan en conflicto y conserva burritos y complementos", () => {
    const base: Cart = {
      packs: [esencial5, burrito6],
      complements: [{ productId: "COM-001", quantity: 1 }],
    };
    const result = resolvePlanConflict(base, proteico5, "replace");
    expect(result.packs.map((p) => p.id)).toEqual(["b6", "p5"]);
    expect(result.complements).toEqual([{ productId: "COM-001", quantity: 1 }]);
  });

  it("nunca deja ambos planes a la vez", () => {
    const result = resolvePlanConflict(cartWith(esencial5), proteico5, "replace");
    expect(cartIssues(result, catalog)).toEqual([]);
    expect(result.packs.map((p) => p.category)).toEqual(["PROTEICO"]);
  });

  it("un pack inválido no entra al carrito", () => {
    const result = addPack(
      EMPTY_CART,
      { ...esencial5, items: [{ productId: "ESE-001", quantity: 4 }] },
      catalog,
    );
    expect(result.status).toBe("invalid");
  });
});

describe("complementos huérfanos", () => {
  it("rechaza un complemento sin ningún pack en el carrito", () => {
    expect(addComplement(EMPTY_CART, "COM-001", catalog)).toEqual({
      status: "rejected",
      reason: "NO_MAIN_PACK",
    });
  });

  it("acepta complemento con un pack de meal prep o de burritos", () => {
    expect(addComplement(cartWith(esencial5), "COM-001", catalog).status).toBe("added");
    expect(addComplement(cartWith(burrito6), "COM-002", catalog).status).toBe("added");
  });

  it("suma cantidades del mismo complemento", () => {
    const first = addComplement(cartWith(esencial5), "COM-001", catalog);
    if (first.status !== "added") throw new Error("esperaba added");
    const second = addComplement(first.cart, "COM-001", catalog);
    if (second.status !== "added") throw new Error("esperaba added");
    expect(second.cart.complements).toEqual([{ productId: "COM-001", quantity: 2 }]);
  });

  it("no acepta platos como complementos ni productos inactivos", () => {
    expect(addComplement(cartWith(esencial5), "ESE-001", catalog)).toEqual({
      status: "rejected",
      reason: "NOT_A_COMPLEMENT",
    });
    expect(addComplement(cartWith(esencial5), "NO-EXISTE", catalog)).toEqual({
      status: "rejected",
      reason: "UNAVAILABLE",
    });
  });

  it("al quitar todos los packs el complemento queda y el checkout se bloquea", () => {
    const withComplement: Cart = {
      packs: [esencial5],
      complements: [{ productId: "COM-001", quantity: 1 }],
    };
    const result = removePack(withComplement, "e5");
    expect(result.complements).toHaveLength(1);
    expect(cartIssues(result, catalog)).toContainEqual({ code: "ORPHAN_COMPLEMENTS" });
    expect(canCheckout(result, catalog)).toBe(false);
  });

  it("se desbloquea si vuelve un pack o se quita el complemento", () => {
    const orphan: Cart = { packs: [], complements: [{ productId: "COM-001", quantity: 1 }] };
    expect(canCheckout({ ...orphan, packs: [burrito6] }, catalog)).toBe(true);
    expect(canCheckout(removeComplement(orphan, "COM-001"), catalog)).toBe(false);
    expect(cartIssues(removeComplement(orphan, "COM-001"), catalog)).toEqual([{ code: "EMPTY" }]);
  });
});

describe("cartIssues", () => {
  it("detecta planes mezclados que llegan sin pasar por addPack (ej. un POST manipulado)", () => {
    expect(cartIssues(cartWith(esencial5, proteico5), catalog)).toContainEqual({
      code: "MIXED_PLANS",
    });
  });

  it("detecta packs incompletos y complementos inválidos", () => {
    const cart: Cart = {
      packs: [{ ...esencial5, items: [{ productId: "ESE-001", quantity: 4 }] }],
      complements: [{ productId: "ESE-001", quantity: 1 }],
    };
    const codes = cartIssues(cart, catalog).map((i) => i.code);
    expect(codes).toContain("PACK_ISSUE");
    expect(codes).toContain("INVALID_COMPLEMENT");
  });

  it("un carrito válido no tiene problemas", () => {
    const cart: Cart = {
      packs: [esencial5, burrito6],
      complements: [{ productId: "COM-001", quantity: 2 }],
    };
    expect(cartIssues(cart, catalog)).toEqual([]);
  });
});
