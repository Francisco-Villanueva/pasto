import { describe, expect, it } from "vitest";
import {
  aggregateProduction,
  formatProductionRow,
  productionToCsv,
  type ProductionOrder,
} from "./production";

const milanesa = { productId: "ESE-001", productName: "Milanesa de pollo napolitana" };
const guiso = { productId: "ESE-003", productName: "Guiso de lentejas" };

const order = (
  status: ProductionOrder["status"],
  details: ProductionOrder["items"][number]["details"],
  scheduledDate = "2026-11-04",
): ProductionOrder => ({ status, scheduledDate, items: [{ details }] });

describe("aggregateProduction", () => {
  it("suma unidades de la misma receta entre pedidos: 4 + 6 = 10", () => {
    const rows = aggregateProduction(
      [
        order("CONFIRMADO", [{ ...milanesa, quantity: 4 }]),
        order("CONFIRMADO", [{ ...milanesa, quantity: 6 }]),
      ],
      "2026-11-04",
    );
    expect(rows).toHaveLength(1);
    expect(formatProductionRow(rows[0]!)).toBe("Milanesa de pollo napolitana: 10 unidades");
  });

  it("suma entre packs del mismo pedido, sin importar cómo se armaron", () => {
    const rows = aggregateProduction(
      [
        {
          status: "EN_PRODUCCION",
          scheduledDate: "2026-11-04",
          items: [
            {
              details: [
                { ...milanesa, quantity: 3 },
                { ...guiso, quantity: 2 },
              ],
            },
            { details: [{ ...milanesa, quantity: 5 }] },
          ],
        },
      ],
      "2026-11-04",
    );
    expect(rows.map((r) => [r.productName, r.units])).toEqual([
      ["Guiso de lentejas", 2],
      ["Milanesa de pollo napolitana", 8],
    ]);
  });

  it("solo cuenta CONFIRMADO y EN_PRODUCCION: PRELIMINAR, PENDIENTE, LISTO, ENTREGADO y CANCELADO quedan afuera", () => {
    const excluded = [
      "PRELIMINAR",
      "PENDIENTE_CONFIRMACION",
      "LISTO",
      "ENTREGADO",
      "CANCELADO",
    ] as const;
    const orders = [
      order("CONFIRMADO", [{ ...milanesa, quantity: 1 }]),
      order("EN_PRODUCCION", [{ ...milanesa, quantity: 1 }]),
      ...excluded.map((status) => order(status, [{ ...milanesa, quantity: 50 }])),
    ];
    expect(aggregateProduction(orders, "2026-11-04")[0]?.units).toBe(2);
  });

  it("filtra por fecha de entrega", () => {
    const rows = aggregateProduction(
      [
        order("CONFIRMADO", [{ ...milanesa, quantity: 4 }], "2026-11-04"),
        order("CONFIRMADO", [{ ...milanesa, quantity: 9 }], "2026-11-06"),
      ],
      "2026-11-06",
    );
    expect(rows[0]?.units).toBe(9);
  });

  it("sin pedidos devuelve una lista vacía", () => {
    expect(aggregateProduction([], "2026-11-04")).toEqual([]);
  });

  it("no incluye importes", () => {
    const [row] = aggregateProduction(
      [order("CONFIRMADO", [{ ...guiso, quantity: 1 }])],
      "2026-11-04",
    );
    expect(Object.keys(row!).sort()).toEqual(["productId", "productName", "units"]);
  });
});

describe("formato", () => {
  it("singular y plural", () => {
    expect(formatProductionRow({ ...guiso, units: 1 })).toBe("Guiso de lentejas: 1 unidad");
  });

  it("exporta CSV con punto y coma y escapa comillas", () => {
    const csv = productionToCsv([
      { ...guiso, units: 2 },
      { productId: "X", productName: 'Plato "especial"; con coma', units: 3 },
    ]);
    expect(csv).toBe(
      'Producto;Unidades\r\nGuiso de lentejas;2\r\n"Plato ""especial""; con coma";3',
    );
  });
});
