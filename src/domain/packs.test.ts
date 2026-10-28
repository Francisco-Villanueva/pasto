import { describe, expect, it } from "vitest";
import { isPackComplete, validatePack } from "./packs";
import { sampleCatalog } from "./sample-catalog";

const catalog = sampleCatalog();

describe("validatePack", () => {
  it("rechaza un pack de 10 con 9 unidades (el botón Agregar queda deshabilitado)", () => {
    const issues = validatePack(
      { category: "ESENCIAL", size: 10, items: [{ productId: "ESE-001", quantity: 9 }] },
      catalog,
    );
    expect(issues).toEqual([{ code: "INCOMPLETE", selected: 9, size: 10 }]);
  });

  it("acepta 10 unidades del mismo plato: la distribución es libre", () => {
    expect(
      isPackComplete(
        { category: "ESENCIAL", size: 10, items: [{ productId: "ESE-001", quantity: 10 }] },
        catalog,
      ),
    ).toBe(true);
  });

  it("acepta mezclas que suman el tamaño", () => {
    expect(
      isPackComplete(
        {
          category: "PROTEICO",
          size: 5,
          items: [
            { productId: "PRO-001", quantity: 2 },
            { productId: "PRO-004", quantity: 3 },
          ],
        },
        catalog,
      ),
    ).toBe(true);
  });

  it("rechaza que se pase del tamaño", () => {
    const issues = validatePack(
      { category: "BURRITO", size: 6, items: [{ productId: "BUR-001", quantity: 7 }] },
      catalog,
    );
    expect(issues).toContainEqual({ code: "OVERFLOW", selected: 7, size: 6 });
  });

  it("valida tamaños por categoría: burritos 6 o 12, planes 5, 10 o 20", () => {
    const burrito5 = validatePack(
      { category: "BURRITO", size: 5, items: [{ productId: "BUR-001", quantity: 5 }] },
      catalog,
    );
    expect(burrito5).toContainEqual({ code: "INVALID_SIZE" });

    const esencial6 = validatePack(
      { category: "ESENCIAL", size: 6, items: [{ productId: "ESE-001", quantity: 6 }] },
      catalog,
    );
    expect(esencial6).toContainEqual({ code: "INVALID_SIZE" });
  });

  it("rechaza platos de otra categoría, desconocidos o inactivos", () => {
    const inactive = new Map(catalog);
    inactive.set("ESE-002", { ...catalog.get("ESE-002")!, isActive: false });

    const issues = validatePack(
      {
        category: "ESENCIAL",
        size: 5,
        items: [
          { productId: "PRO-001", quantity: 1 },
          { productId: "NO-EXISTE", quantity: 1 },
          { productId: "ESE-002", quantity: 3 },
        ],
      },
      inactive,
    );
    expect(issues).toContainEqual({ code: "WRONG_CATEGORY", productId: "PRO-001" });
    expect(issues).toContainEqual({ code: "UNKNOWN_PRODUCT", productId: "NO-EXISTE" });
    expect(issues).toContainEqual({ code: "INACTIVE_PRODUCT", productId: "ESE-002" });
  });

  it("rechaza cantidades no enteras o menores a uno", () => {
    const issues = validatePack(
      {
        category: "ESENCIAL",
        size: 5,
        items: [
          { productId: "ESE-001", quantity: 2.5 },
          { productId: "ESE-002", quantity: 0 },
        ],
      },
      catalog,
    );
    expect(issues).toContainEqual({ code: "INVALID_QUANTITY", productId: "ESE-001" });
    expect(issues).toContainEqual({ code: "INVALID_QUANTITY", productId: "ESE-002" });
  });
});
