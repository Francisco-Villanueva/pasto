import { describe, expect, it } from "vitest";
import { describeDraftErrors } from "./checkout-errors";

describe("describeDraftErrors", () => {
  it("explica cada problema en español y sin repetir", () => {
    const messages = describeDraftErrors([
      {
        code: "CART_INVALID",
        issues: [
          { code: "ORPHAN_COMPLEMENTS" },
          { code: "PACK_ISSUE", packId: "a", issue: { code: "INCOMPLETE", selected: 4, size: 5 } },
          { code: "PACK_ISSUE", packId: "b", issue: { code: "INCOMPLETE", selected: 3, size: 5 } },
        ],
      },
      { code: "DAY_UNAVAILABLE" },
      { code: "OUT_OF_RANGE" },
    ]);

    expect(messages).toHaveLength(4);
    expect(messages[0]).toContain("Los complementos no se pueden pedir solos");
    expect(messages[2]).toBe("Ese día ya no está disponible. Elegí otro.");
    expect(messages[3]).toContain("retirar tu pedido en el local");
  });

  it("no tiene mensajes técnicos ni códigos internos", () => {
    const all = describeDraftErrors([
      { code: "PRICE_MISSING", keys: ["ESENCIAL:5"] },
      { code: "SLOT_INVALID" },
      { code: "ADDRESS_REQUIRED" },
    ]).join(" ");
    expect(all).not.toMatch(/ESENCIAL:5|SLOT_INVALID|undefined/);
  });
});
