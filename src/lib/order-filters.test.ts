import { describe, expect, it } from "vitest";
import { orderFiltersToQuery, parseOrderFilters } from "./order-filters";

describe("parseOrderFilters", () => {
  it("lee los filtros válidos", () => {
    expect(
      parseOrderFilters({
        fecha: "2026-11-04",
        estado: "CONFIRMADO",
        entrega: "DELIVERY",
        pago: "PAGADO",
        q: "  lucía ",
        pagina: "3",
      }),
    ).toEqual({
      date: "2026-11-04",
      status: "CONFIRMADO",
      deliveryType: "DELIVERY",
      paymentStatus: "PAGADO",
      q: "lucía",
      page: 3,
    });
  });

  it("ignora lo inválido en lugar de romper la consulta", () => {
    expect(
      parseOrderFilters({
        fecha: "mañana",
        estado: "ROTO",
        entrega: "x",
        pago: "y",
        q: "   ",
        pagina: "-2",
      }),
    ).toEqual({
      date: undefined,
      status: undefined,
      deliveryType: undefined,
      paymentStatus: undefined,
      q: undefined,
      page: undefined,
    });
    expect(parseOrderFilters({ pagina: "1.5" }).page).toBeUndefined();
  });

  it("toma el primer valor si el parámetro viene repetido y corta búsquedas larguísimas", () => {
    expect(parseOrderFilters({ estado: ["LISTO", "ENTREGADO"] }).status).toBe("LISTO");
    expect(parseOrderFilters({ q: "a".repeat(500) }).q).toHaveLength(80);
  });
});

describe("orderFiltersToQuery", () => {
  it("arma la URL y omite lo vacío y la página 1", () => {
    expect(orderFiltersToQuery({})).toBe("");
    expect(orderFiltersToQuery({ status: "LISTO", q: "ana" }, 1)).toBe("?estado=LISTO&q=ana");
    expect(orderFiltersToQuery({ date: "2026-11-04" }, 2)).toBe("?fecha=2026-11-04&pagina=2");
  });

  it("es el inverso de parseOrderFilters", () => {
    const filters = { date: "2026-11-04", status: "CONFIRMADO" as const, q: "ñoqui & más" };
    const query = new URLSearchParams(orderFiltersToQuery(filters, 2));
    expect(parseOrderFilters(Object.fromEntries(query))).toMatchObject({ ...filters, page: 2 });
  });
});
