import { describe, expect, it } from "vitest";
import { parseSuggestion } from "./address";

describe("parseSuggestion", () => {
  it("separa calle, número y barrio", () => {
    expect(
      parseSuggestion("Alsina 456", "Centro, Bahía Blanca, Provincia de Buenos Aires, Argentina"),
    ).toEqual({
      street: "Alsina",
      number: "456",
      neighborhood: "Centro",
    });
  });

  it("acepta calles con varias palabras, coma y número con letra", () => {
    expect(parseSuggestion("Av. Colón, 1800", "Palihue · 4,5 km (simulado)")).toEqual({
      street: "Av. Colón",
      number: "1800",
      neighborhood: "Palihue",
    });
    expect(parseSuggestion("Calle 12 de Octubre 77B", "Norte")).toEqual({
      street: "Calle 12 de Octubre",
      number: "77B",
      neighborhood: "Norte",
    });
  });

  it("si no hay número deja la calle completa y el número vacío para que lo escriba la persona", () => {
    expect(parseSuggestion("Camino de la Carrindanga", "")).toEqual({
      street: "Camino de la Carrindanga",
      number: "",
      neighborhood: "",
    });
  });
});
