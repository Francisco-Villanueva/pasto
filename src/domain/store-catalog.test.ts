import { describe, expect, it } from "vitest";
import { sumMacros, ZERO_MACROS } from "./macros";
import {
  activeProducts,
  hasProductInfo,
  sampleStoreCatalog,
  startingPrice,
  toDomainCatalog,
  toPriceTable,
} from "./store-catalog";

const catalog = sampleStoreCatalog();

describe("catálogo de la tienda", () => {
  it("arma el catálogo de dominio indexado por id", () => {
    const domain = toDomainCatalog(catalog);
    expect(domain.get("ESE-001")).toMatchObject({
      name: "Milanesa de pollo napolitana",
      isActive: true,
    });
    expect(domain.get("COM-001")?.priceCents).toBe(950_000);
  });

  it("arma la tabla de precios por categoría y tamaño", () => {
    const prices = toPriceTable(catalog);
    expect(prices.get("ESENCIAL:10")).toBe(4_000_000);
    expect(prices.get("BURRITO:6")).toBe(1_800_000);
  });

  it("lista solo los platos activos de una categoría", () => {
    const inactive = {
      ...catalog,
      products: catalog.products.map((p) => (p.sku === "ESE-002" ? { ...p, isActive: false } : p)),
    };
    expect(activeProducts(inactive, "ESENCIAL").map((p) => p.sku)).toEqual([
      "ESE-001",
      "ESE-003",
      "ESE-004",
    ]);
  });

  it("calcula el precio 'desde' de cada categoría", () => {
    expect(startingPrice(catalog, "ESENCIAL")).toBe(2_150_000);
    expect(startingPrice(catalog, "PROTEICO")).toBe(2_500_000);
    expect(startingPrice(catalog, "BURRITO")).toBe(1_800_000);
    expect(startingPrice({ ...catalog, tiers: [] }, "BURRITO")).toBeNull();
  });
});

describe("hasProductInfo", () => {
  it("no toma como dato real lo que está vacío o dice 'A completar'", () => {
    expect(hasProductInfo("")).toBe(false);
    expect(hasProductInfo("   ")).toBe(false);
    expect(hasProductInfo("A completar")).toBe(false);
    expect(hasProductInfo(null)).toBe(false);
    expect(hasProductInfo("Gluten, lácteos")).toBe(true);
  });
});

describe("sumMacros", () => {
  const macros = new Map(catalog.products.map((p) => [p.id, p.macros]));

  it("multiplica las macros de cada plato por sus unidades", () => {
    const total = sumMacros(
      [
        { productId: "ESE-001", quantity: 3 }, // 520/38/42/20
        { productId: "ESE-003", quantity: 2 }, // 430/24/58/10
      ],
      macros,
    );
    expect(total).toEqual({ calories: 2420, protein: 162, carbs: 242, fats: 80 });
  });

  it("ignora platos sin macros, desconocidos o con cantidad cero", () => {
    expect(
      sumMacros(
        [
          { productId: "COM-001", quantity: 2 },
          { productId: "NO-EXISTE", quantity: 2 },
          { productId: "ESE-001", quantity: 0 },
        ],
        macros,
      ),
    ).toEqual(ZERO_MACROS);
  });
});
