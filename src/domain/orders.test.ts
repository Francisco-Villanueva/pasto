import { describe, expect, it } from "vitest";
import {
  ORDER_STATUSES,
  abandonAfterHoursFromSetting,
  allowedTargets,
  checkTransition,
  isAbandoned,
  isCountedInProduction,
  isCountedInRevenue,
  isEditableByAdmin,
  type OrderStatus,
} from "./orders";

const allowed = (from: OrderStatus, to: OrderStatus, role: "ADMIN" | "COCINA" = "ADMIN") =>
  checkTransition(from, to, role).allowed;

describe("camino normal (ADMIN)", () => {
  it("avanza paso a paso", () => {
    expect(allowed("PRELIMINAR", "PENDIENTE_CONFIRMACION")).toBe(true);
    expect(allowed("PENDIENTE_CONFIRMACION", "CONFIRMADO")).toBe(true);
    expect(allowed("CONFIRMADO", "EN_PRODUCCION")).toBe(true);
    expect(allowed("EN_PRODUCCION", "LISTO")).toBe(true);
    expect(allowed("LISTO", "ENTREGADO")).toBe(true);
  });

  it("puede saltar estados hacia adelante", () => {
    expect(allowed("CONFIRMADO", "ENTREGADO")).toBe(true);
    expect(allowed("PENDIENTE_CONFIRMACION", "LISTO")).toBe(true);
  });

  it("retrocede de a un paso, no varios", () => {
    expect(allowed("CONFIRMADO", "PENDIENTE_CONFIRMACION")).toBe(true);
    expect(allowed("EN_PRODUCCION", "CONFIRMADO")).toBe(true);
    expect(allowed("LISTO", "EN_PRODUCCION")).toBe(true);
    expect(allowed("ENTREGADO", "LISTO")).toBe(true);
    expect(allowed("ENTREGADO", "CONFIRMADO")).toBe(false);
    expect(allowed("LISTO", "PENDIENTE_CONFIRMACION")).toBe(false);
  });

  it("no vuelve a PRELIMINAR desde un estado avanzado", () => {
    expect(allowed("PENDIENTE_CONFIRMACION", "PRELIMINAR")).toBe(false);
    expect(allowed("CONFIRMADO", "PRELIMINAR")).toBe(false);
  });

  it("no acepta el mismo estado", () => {
    expect(checkTransition("CONFIRMADO", "CONFIRMADO", "ADMIN")).toEqual({
      allowed: false,
      reason: "SAME_STATUS",
    });
  });
});

describe("cancelación y reactivación", () => {
  it("se cancela hasta LISTO, con motivo obligatorio", () => {
    for (const from of [
      "PRELIMINAR",
      "PENDIENTE_CONFIRMACION",
      "CONFIRMADO",
      "EN_PRODUCCION",
      "LISTO",
    ] as const) {
      const result = checkTransition(from, "CANCELADO", "ADMIN");
      expect(result.allowed).toBe(true);
      if (result.allowed) expect(result.effects.requiresCancellationReason).toBe(true);
    }
  });

  it("un pedido entregado no se cancela: primero se corrige la entrega", () => {
    expect(allowed("ENTREGADO", "CANCELADO")).toBe(false);
  });

  it("un cancelado solo vuelve a PRELIMINAR o PENDIENTE_CONFIRMACION y borra el motivo", () => {
    const result = checkTransition("CANCELADO", "PENDIENTE_CONFIRMACION", "ADMIN");
    expect(result.allowed).toBe(true);
    if (result.allowed) expect(result.effects.clearCancellationReason).toBe(true);
    expect(allowed("CANCELADO", "PRELIMINAR")).toBe(true);
    expect(allowed("CANCELADO", "CONFIRMADO")).toBe(false);
    expect(allowed("CANCELADO", "ENTREGADO")).toBe(false);
  });
});

describe("entrega", () => {
  it("al entregar se completa delivered_at y se crean las tareas CRM (también si se salta)", () => {
    for (const from of ["LISTO", "CONFIRMADO"] as const) {
      const result = checkTransition(from, "ENTREGADO", "ADMIN");
      expect(result.allowed && result.effects.markDelivered).toBe(true);
    }
  });

  it("corregir una entrega deshace delivered_at y las tareas pendientes", () => {
    const result = checkTransition("ENTREGADO", "LISTO", "ADMIN");
    expect(result.allowed && result.effects.undoDelivery).toBe(true);
  });
});

describe("rol COCINA", () => {
  it("marca solo EN_PRODUCCION y LISTO", () => {
    expect(allowed("CONFIRMADO", "EN_PRODUCCION", "COCINA")).toBe(true);
    expect(allowed("EN_PRODUCCION", "LISTO", "COCINA")).toBe(true);
  });

  it("no confirma, no entrega, no cancela, no retrocede ni salta", () => {
    expect(allowed("PENDIENTE_CONFIRMACION", "CONFIRMADO", "COCINA")).toBe(false);
    expect(allowed("LISTO", "ENTREGADO", "COCINA")).toBe(false);
    expect(allowed("CONFIRMADO", "CANCELADO", "COCINA")).toBe(false);
    expect(allowed("EN_PRODUCCION", "CONFIRMADO", "COCINA")).toBe(false);
    expect(allowed("CONFIRMADO", "LISTO", "COCINA")).toBe(false);
  });

  it("lista los destinos permitidos por rol", () => {
    expect(allowedTargets("CONFIRMADO", "COCINA")).toEqual(["EN_PRODUCCION"]);
    expect(allowedTargets("ENTREGADO", "COCINA")).toEqual([]);
    expect(allowedTargets("PRELIMINAR", "ADMIN")).toContain("CANCELADO");
  });
});

describe("qué estados cuentan", () => {
  it("producción: solo CONFIRMADO y EN_PRODUCCION", () => {
    const counted = ORDER_STATUSES.filter(isCountedInProduction);
    expect(counted).toEqual(["CONFIRMADO", "EN_PRODUCCION"]);
  });

  it("ingresos: nunca PRELIMINAR, PENDIENTE_CONFIRMACION ni CANCELADO", () => {
    const counted = ORDER_STATUSES.filter(isCountedInRevenue);
    expect(counted).toEqual(["CONFIRMADO", "EN_PRODUCCION", "LISTO", "ENTREGADO"]);
  });

  it("el admin edita hasta confirmar", () => {
    expect(ORDER_STATUSES.filter(isEditableByAdmin)).toEqual([
      "PRELIMINAR",
      "PENDIENTE_CONFIRMACION",
    ]);
  });
});

describe("ajuste abandon_after_hours", () => {
  it("usa 48 h si no está configurado o es inválido", () => {
    expect(abandonAfterHoursFromSetting(undefined)).toBe(48);
    expect(abandonAfterHoursFromSetting(null)).toBe(48);
    expect(abandonAfterHoursFromSetting("24")).toBe(48);
    expect(abandonAfterHoursFromSetting(-5)).toBe(48);
  });

  it("respeta el plazo del admin y 0 desactiva la regla", () => {
    expect(abandonAfterHoursFromSetting(24)).toBe(24);
    expect(abandonAfterHoursFromSetting(0)).toBeNull();
  });
});

describe("abandono de PRELIMINAR", () => {
  const createdAt = new Date("2026-11-01T10:00:00-03:00");

  it("cancela a las 48 h", () => {
    const order = { status: "PRELIMINAR" as const, createdAt };
    expect(isAbandoned(order, new Date("2026-11-03T09:59:00-03:00"), 48)).toBe(false);
    expect(isAbandoned(order, new Date("2026-11-03T10:00:00-03:00"), 48)).toBe(true);
  });

  it("el plazo es configurable", () => {
    const order = { status: "PRELIMINAR" as const, createdAt };
    expect(isAbandoned(order, new Date("2026-11-02T10:00:00-03:00"), 24)).toBe(true);
  });

  it("con la regla desactivada nunca cancela", () => {
    const order = { status: "PRELIMINAR" as const, createdAt };
    expect(isAbandoned(order, new Date("2027-01-01T00:00:00-03:00"), null)).toBe(false);
  });

  it("solo afecta a PRELIMINAR: un pedido que ya leyó el admin no se cancela solo", () => {
    const order = { status: "PENDIENTE_CONFIRMACION" as const, createdAt };
    expect(isAbandoned(order, new Date("2027-01-01T00:00:00-03:00"), 48)).toBe(false);
  });
});
