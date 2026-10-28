import { describe, expect, it } from "vitest";
import { isCheckoutEnabled, parseStoreSettings } from "./settings";

describe("parseStoreSettings", () => {
  it("sin nada configurado deja todo en 'sin configurar' y el checkout deshabilitado", () => {
    const settings = parseStoreSettings({});
    expect(settings).toMatchObject({
      whatsapp: null,
      fudoUrl: null,
      storeAddress: null,
      storeLocation: null,
      maxDistanceM: 10_000,
      defaultSlots: [],
      abandonAfterHours: 48,
    });
    expect(isCheckoutEnabled(settings)).toBe(false);
  });

  it("lee los ajustes cargados", () => {
    const settings = parseStoreSettings({
      pasto_whatsapp: "+5492915550123",
      fudo_url: "https://fudo.example/pasto",
      store_location: { lat: -38.7, lng: -62.27 },
      delivery_max_distance_m: 8_000,
      default_slots: ["12:00 a 14:00", "", 5],
      abandon_after_hours: 0,
    });
    expect(settings.whatsapp).toBe("+5492915550123");
    expect(settings.fudoUrl).toBe("https://fudo.example/pasto");
    expect(settings.storeLocation).toEqual({ lat: -38.7, lng: -62.27 });
    expect(settings.maxDistanceM).toBe(8_000);
    expect(settings.defaultSlots).toEqual(["12:00 a 14:00"]);
    expect(settings.abandonAfterHours).toBeNull(); // 0 desactiva la regla
    expect(isCheckoutEnabled(settings)).toBe(true);
  });

  it("descarta valores inválidos en vez de usarlos", () => {
    const settings = parseStoreSettings({
      pasto_whatsapp: "no es un telefono",
      store_location: { lat: 999, lng: 0 },
      delivery_max_distance_m: -5,
      fudo_url: "   ",
    });
    expect(settings.whatsapp).toBeNull();
    expect(settings.storeLocation).toBeNull();
    expect(settings.maxDistanceM).toBe(10_000);
    expect(settings.fudoUrl).toBeNull();
  });
});
