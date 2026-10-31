import { describe, expect, it } from "vitest";
import {
  parsePesos,
  parseTierPrices,
  pesosField,
  productFormSchema,
  recipeVersionWarning,
} from "./catalog-admin";

const base = {
  id: null,
  name: "Guiso de lentejas",
  sku: "guiso-lentejas",
  category: "ESENCIAL",
  description: "",
  ingredients: "",
  allergens: "",
  netWeightG: "",
  calories: "",
  protein: "",
  carbs: "",
  fats: "",
  imageUrl: "",
  price: "",
  recipeVersion: "v1.0",
  isActive: true,
};

describe("importes en pesos", () => {
  it("lee los formatos habituales", () => {
    expect(parsePesos("21500")).toBe(2_150_000);
    expect(parsePesos("$21.500")).toBe(2_150_000);
    expect(parsePesos("21500,5")).toBe(2_150_050);
    expect(parsePesos("1.234,56")).toBe(123_456);
  });
  it("rechaza lo que no es un importe", () => {
    for (const bad of ["", "abc", "-5", "12,345", "1.23", "1e5"])
      expect(parsePesos(bad)).toBeNull();
  });
  it("ida y vuelta", () => {
    expect(pesosField(2_150_000)).toBe("21500");
    expect(pesosField(2_150_050)).toBe("21500,50");
    expect(pesosField(null)).toBe("");
  });
});

describe("formulario de plato", () => {
  it("normaliza el código y deja nulos los opcionales vacíos", () => {
    const r = productFormSchema.parse(base);
    expect(r.sku).toBe("GUISO-LENTEJAS");
    expect(r.macros).toBeNull();
    expect(r.imageUrl).toBeNull();
    expect(r.priceCents).toBeNull();
  });

  it("pide los cuatro valores nutricionales o ninguno", () => {
    expect(productFormSchema.safeParse({ ...base, calories: "300" }).success).toBe(false);
    const ok = productFormSchema.parse({
      ...base,
      calories: "300",
      protein: "25",
      carbs: "30",
      fats: "9",
    });
    expect(ok.macros).toEqual({ calories: 300, protein: 25, carbs: 30, fats: 9 });
  });

  it("los complementos exigen precio y los demás lo ignoran", () => {
    expect(productFormSchema.safeParse({ ...base, category: "COMPLEMENTO" }).success).toBe(false);
    const comp = productFormSchema.parse({ ...base, category: "COMPLEMENTO", price: "4.500" });
    expect(comp.priceCents).toBe(450_000);
    expect(productFormSchema.parse({ ...base, price: "4500" }).priceCents).toBeNull();
  });

  it("valida versión de receta e imagen", () => {
    expect(productFormSchema.safeParse({ ...base, recipeVersion: "1" }).success).toBe(false);
    expect(productFormSchema.safeParse({ ...base, imageUrl: "http://x.com/a.jpg" }).success).toBe(
      false,
    );
    expect(productFormSchema.safeParse({ ...base, imageUrl: "https://x.com/a.jpg" }).success).toBe(
      true,
    );
  });

  it("rechaza números fuera de rango o con texto", () => {
    expect(productFormSchema.safeParse({ ...base, netWeightG: "9999" }).success).toBe(false);
    expect(productFormSchema.safeParse({ ...base, netWeightG: "12a" }).success).toBe(false);
  });
});

describe("aviso de versión de receta", () => {
  const before = { ingredients: "lentejas", description: "", recipeVersion: "v1.0" };
  it("avisa si cambian los ingredientes sin subir la versión", () => {
    expect(recipeVersionWarning(before, { ...before, ingredients: "lentejas, zanahoria" })).toMatch(
      /versión de receta/,
    );
  });
  it("no avisa si subió la versión o no hubo cambios", () => {
    expect(
      recipeVersionWarning(before, { ...before, ingredients: "x", recipeVersion: "v1.1" }),
    ).toBeNull();
    expect(recipeVersionWarning(before, { ...before })).toBeNull();
  });
});

describe("precios por tamaño", () => {
  it("convierte todos o falla", () => {
    expect(parseTierPrices([{ id: "a", price: "21500" }])).toEqual({
      ok: true,
      tiers: [{ id: "a", priceCents: 2_150_000 }],
    });
    expect(parseTierPrices([{ id: "a", price: "0" }]).ok).toBe(false);
  });
});
