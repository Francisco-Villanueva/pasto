import { describe, expect, it } from "vitest";
import { validateAbandonHours, validateShipping, validateSlots } from "./agenda";

describe("validateSlots", () => {
  it("limpia espacios y acepta una lista vacía", () => {
    expect(validateSlots(["  12:00   a 14:00 "])).toEqual({ ok: true, slots: ["12:00 a 14:00"] });
    expect(validateSlots([])).toEqual({ ok: true, slots: [] });
  });

  it("rechaza vacías, repetidas (sin distinguir mayúsculas), muy largas y demasiadas", () => {
    expect(validateSlots(["  "])).toEqual({ ok: false, issue: "SLOTS_EMPTY_NAME" });
    expect(validateSlots(["Tarde", "tarde"])).toEqual({ ok: false, issue: "SLOTS_DUPLICATED" });
    expect(validateSlots(["x".repeat(41)])).toEqual({ ok: false, issue: "SLOTS_TOO_LONG" });
    expect(validateSlots(Array.from({ length: 9 }, (_, i) => `F${i}`))).toEqual({
      ok: false,
      issue: "SLOTS_TOO_MANY",
    });
  });
});

describe("validateShipping", () => {
  const tiers = [
    { upToM: 3000, feeCents: 250_000 },
    { upToM: 1000, feeCents: 150_000 },
  ];

  it("ordena los tramos por distancia", () => {
    const result = validateShipping(tiers, 5000);
    expect(result.ok && result.tiers.map((t) => t.upToM)).toEqual([1000, 3000]);
  });

  it("rechaza tablas vacías, distancias o costos inválidos y repetidos", () => {
    expect(validateShipping([], 5000)).toEqual({ ok: false, issue: "TIERS_EMPTY" });
    expect(validateShipping([{ upToM: 0, feeCents: 0 }], 5000)).toEqual({
      ok: false,
      issue: "TIER_DISTANCE_INVALID",
    });
    expect(validateShipping([{ upToM: 1000, feeCents: -1 }], 5000)).toEqual({
      ok: false,
      issue: "TIER_FEE_INVALID",
    });
    expect(
      validateShipping(
        [
          { upToM: 1000, feeCents: 0 },
          { upToM: 1000, feeCents: 5 },
        ],
        5000,
      ),
    ).toEqual({ ok: false, issue: "TIER_DISTANCE_DUPLICATED" });
  });

  it("el radio máximo tiene que ser válido y cubrir el último tramo", () => {
    expect(validateShipping(tiers, 0)).toEqual({ ok: false, issue: "MAX_DISTANCE_INVALID" });
    expect(validateShipping(tiers, 2000)).toEqual({
      ok: false,
      issue: "MAX_DISTANCE_BELOW_TIERS",
    });
  });
});

describe("validateAbandonHours", () => {
  it("0 desactiva; acepta enteros hasta 30 días", () => {
    expect(validateAbandonHours(0)).toBe(true);
    expect(validateAbandonHours(48)).toBe(true);
    expect(validateAbandonHours(720)).toBe(true);
    expect(validateAbandonHours(721)).toBe(false);
    expect(validateAbandonHours(-1)).toBe(false);
    expect(validateAbandonHours(1.5)).toBe(false);
  });
});
