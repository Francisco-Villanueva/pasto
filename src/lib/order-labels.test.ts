import { describe, expect, it } from "vitest";
import { allowedTargets } from "@/domain/orders";
import { describeChange, describeTransition, orderActions } from "./order-labels";

describe("describeChange", () => {
  it("cambios de estado, con motivo si lo hay", () => {
    expect(
      describeChange({
        kind: "ESTADO",
        note: null,
        before: { status: "PRELIMINAR" },
        after: { status: "CONFIRMADO" },
      }),
    ).toEqual({ title: "Pasó a confirmado", lines: [] });
    expect(
      describeChange({
        kind: "ESTADO",
        note: "No respondió",
        before: { status: "CONFIRMADO" },
        after: { status: "CANCELADO" },
      }),
    ).toEqual({ title: "Pasó a cancelado", lines: ["Motivo: No respondió"] });
  });

  it("la creación muestra cómo se creó", () => {
    expect(
      describeChange({
        kind: "ESTADO",
        note: "Pedido cargado manualmente",
        before: null,
        after: { status: "PENDIENTE_CONFIRMACION" },
      }),
    ).toEqual({ title: "Pedido cargado manualmente", lines: [] });
  });

  it("ediciones, una línea por campo", () => {
    expect(
      describeChange({
        kind: "EDICION",
        note: "Día: A → B\nTotal: $1 → $2",
        before: {},
        after: {},
      }),
    ).toEqual({ title: "Editó el pedido", lines: ["Día: A → B", "Total: $1 → $2"] });
  });

  it("pagos", () => {
    expect(
      describeChange({
        kind: "PAGO",
        note: null,
        before: {},
        after: { method: "TRANSFERENCIA", status: "PAGADO" },
      }),
    ).toEqual({ title: "Pago: transferencia · pagado", lines: [] });
  });
});

describe("describeTransition", () => {
  it("nombra cada paso hacia adelante con un verbo", () => {
    expect(describeTransition("PRELIMINAR", "PENDIENTE_CONFIRMACION")).toEqual({
      label: "Marcar pendiente de confirmación",
      kind: "forward",
    });
    expect(describeTransition("PENDIENTE_CONFIRMACION", "CONFIRMADO")).toEqual({
      label: "Confirmar pedido",
      kind: "forward",
    });
    expect(describeTransition("LISTO", "ENTREGADO")).toEqual({
      label: "Marcar entregado",
      kind: "forward",
    });
  });

  it("distingue saltos, vueltas atrás, cancelar y reactivar", () => {
    expect(describeTransition("CONFIRMADO", "ENTREGADO").kind).toBe("skip");
    expect(describeTransition("ENTREGADO", "LISTO")).toEqual({
      label: "Volver a listo",
      kind: "back",
    });
    expect(describeTransition("CONFIRMADO", "CANCELADO")).toEqual({
      label: "Cancelar con motivo",
      kind: "cancel",
    });
    expect(describeTransition("CANCELADO", "PENDIENTE_CONFIRMACION")).toEqual({
      label: "Reactivar como pendiente de confirmación",
      kind: "reactivate",
    });
  });
});

describe("orderActions", () => {
  it("pone primero el paso siguiente y último cancelar", () => {
    const actions = orderActions(
      "PENDIENTE_CONFIRMACION",
      allowedTargets("PENDIENTE_CONFIRMACION", "ADMIN"),
    );
    expect(actions[0]).toMatchObject({ to: "CONFIRMADO", kind: "forward" });
    expect(actions.at(-1)).toMatchObject({ to: "CANCELADO", kind: "cancel" });
    expect(actions.filter((a) => a.kind === "forward")).toHaveLength(1);
  });

  it("un pedido entregado solo ofrece corregir la entrega", () => {
    expect(
      orderActions("ENTREGADO", allowedTargets("ENTREGADO", "ADMIN")).map((a) => a.to),
    ).toEqual(["LISTO"]);
  });

  it("un pedido cancelado solo se puede reactivar", () => {
    const actions = orderActions("CANCELADO", allowedTargets("CANCELADO", "ADMIN"));
    expect(actions.map((a) => a.kind)).toEqual(["reactivate", "reactivate"]);
  });

  it("Cocina ve solo su paso", () => {
    expect(
      orderActions("CONFIRMADO", allowedTargets("CONFIRMADO", "COCINA")).map((a) => a.to),
    ).toEqual(["EN_PRODUCCION"]);
  });
});
