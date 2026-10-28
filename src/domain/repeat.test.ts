import { describe, expect, it } from "vitest";
import { cartIssues } from "./cart";
import { priceCart } from "./pricing";
import { repeatOrder, type PreviousOrder } from "./repeat";
import { sampleCatalog, samplePrices } from "./sample-catalog";

const previous: PreviousOrder = {
  items: [
    {
      category: "ESENCIAL",
      tierSize: 5,
      details: [
        { productId: "ESE-001", quantity: 3 },
        { productId: "ESE-003", quantity: 2 },
      ],
    },
  ],
  complements: [{ productId: "COM-001", quantity: 1 }],
};

let counter = 0;
const newId = () => `pack-${++counter}`;

describe("repeatOrder", () => {
  it("arma un carrito nuevo con las selecciones anteriores", () => {
    const { cart, unavailableProductIds } = repeatOrder(previous, sampleCatalog(), newId);
    expect(unavailableProductIds).toEqual([]);
    expect(cart.packs[0]?.items).toEqual(previous.items[0]!.details);
    expect(cart.complements).toEqual(previous.complements);
    expect(cartIssues(cart, sampleCatalog())).toEqual([]);
  });

  it("recalcula el precio con el catálogo vigente, no con el del pedido anterior", () => {
    const { cart } = repeatOrder(previous, sampleCatalog(), newId);
    const updated = new Map(samplePrices());
    updated.set("ESENCIAL:5", 2_500_000);

    const before = priceCart(cart, samplePrices(), sampleCatalog());
    const after = priceCart(cart, updated, sampleCatalog());
    if (!before.ok || !after.ok) throw new Error("esperaba ok");
    expect(after.subtotalCents - before.subtotalCents).toBe(350_000);
  });

  it("un plato discontinuado queda marcado y el pack vuelve incompleto hasta reemplazarlo", () => {
    const catalog = new Map(sampleCatalog());
    catalog.set("ESE-003", { ...catalog.get("ESE-003")!, isActive: false });

    const { cart, unavailableProductIds } = repeatOrder(previous, catalog, newId);
    expect(unavailableProductIds).toEqual(["ESE-003"]);
    expect(cart.packs[0]?.items).toEqual([{ productId: "ESE-001", quantity: 3 }]);
    expect(cartIssues(cart, catalog)).toContainEqual({
      code: "PACK_ISSUE",
      packId: cart.packs[0]!.id,
      issue: { code: "INCOMPLETE", selected: 3, size: 5 },
    });
  });

  it("un complemento discontinuado se quita y se avisa", () => {
    const catalog = new Map(sampleCatalog());
    catalog.set("COM-001", { ...catalog.get("COM-001")!, isActive: false });
    const { cart, unavailableProductIds } = repeatOrder(previous, catalog, newId);
    expect(cart.complements).toEqual([]);
    expect(unavailableProductIds).toEqual(["COM-001"]);
  });
});
