import { describe, expect, it } from "vitest";
import { nextTheme, parseTheme, resolveTheme } from "./theme";

describe("theme", () => {
  it("acepta solo los temas del sistema de diseño", () => {
    expect(parseTheme("arena")).toBe("arena");
    expect(parseTheme("carbon")).toBe("carbon");
    expect(parseTheme("dark")).toBeNull();
    expect(parseTheme(null)).toBeNull();
  });

  it("usa el tema guardado y, si no hay, el del sistema", () => {
    expect(resolveTheme("arena", true)).toBe("arena");
    expect(resolveTheme(null, true)).toBe("carbon");
    expect(resolveTheme("otro", false)).toBe("arena");
  });

  it("alterna entre arena y carbon", () => {
    expect(nextTheme("arena")).toBe("carbon");
    expect(nextTheme("carbon")).toBe("arena");
  });
});
