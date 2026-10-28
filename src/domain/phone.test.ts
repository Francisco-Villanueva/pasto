import { describe, expect, it } from "vitest";
import { isE164Mobile, normalizeArPhone } from "./phone";

describe("normalizeArPhone", () => {
  it("deja igual un número ya normalizado", () => {
    expect(normalizeArPhone("+5492915550123")).toBe("+5492915550123");
  });

  it("acepta las formas habituales de escribirlo", () => {
    expect(normalizeArPhone("+54 9 291 555 0123")).toBe("+5492915550123");
    expect(normalizeArPhone("54 9 291 5550123")).toBe("+5492915550123");
    expect(normalizeArPhone("291 555-0123")).toBe("+5492915550123");
    expect(normalizeArPhone("(291) 5550123")).toBe("+5492915550123");
  });

  it("quita el 0 de larga distancia y el 15 de los celulares", () => {
    expect(normalizeArPhone("0291 15 555 0123")).toBe("+5492915550123");
    expect(normalizeArPhone("011 15 5555 1234")).toBe("+5491155551234");
    expect(normalizeArPhone("11 15 5555 1234")).toBe("+5491155551234");
  });

  it("acepta el prefijo internacional 00", () => {
    expect(normalizeArPhone("00 54 9 11 5555 1234")).toBe("+5491155551234");
  });

  it("no toca un número válido que casualmente contiene 15", () => {
    expect(normalizeArPhone("11 1555 1234")).toBe("+5491115551234");
  });

  it("rechaza lo que no es un celular de 10 dígitos", () => {
    expect(normalizeArPhone("")).toBeNull();
    expect(normalizeArPhone("12345")).toBeNull();
    expect(normalizeArPhone("abc")).toBeNull();
    expect(normalizeArPhone("+1 415 555 2671")).toBeNull();
    expect(normalizeArPhone("291 555 01234567")).toBeNull();
  });
});

describe("isE164Mobile", () => {
  it("reconoce el formato de WhatsApp", () => {
    expect(isE164Mobile("+5492915550123")).toBe(true);
    expect(isE164Mobile("+542915550123")).toBe(false);
    expect(isE164Mobile("2915550123")).toBe(false);
  });
});
