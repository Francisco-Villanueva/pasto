import { describe, expect, it } from "vitest";
import { centsFromNumeric, formatMoney, numericFromCents } from "./money";

describe("money", () => {
  it("convierte NUMERIC(10,2) a centavos sin pasar por float", () => {
    expect(centsFromNumeric("21500.00")).toBe(2_150_000);
    expect(centsFromNumeric("0.10")).toBe(10);
    expect(centsFromNumeric("19.9")).toBe(1990);
    expect(centsFromNumeric(100)).toBe(10_000);
  });

  it("convierte centavos al formato de la base", () => {
    expect(numericFromCents(2_150_000)).toBe("21500.00");
    expect(numericFromCents(5)).toBe("0.05");
  });

  it("da formato es-AR", () => {
    expect(formatMoney(2_150_000)).toBe("$21.500");
    expect(formatMoney(100_000_050)).toBe("$1.000.000,50");
    expect(formatMoney(0)).toBe("$0");
  });
});
