import { describe, expect, it, vi } from "vitest";
import { drivingDistanceM, isMapsEnabled, suggestAddresses } from "./maps";
import { createRateLimiter } from "./rate-limit";
import { verifyTurnstile } from "./turnstile";

const json = (body: unknown, ok = true) =>
  vi.fn(async () => ({ ok, json: async () => body }) as unknown as Response);

describe("suggestAddresses", () => {
  it("no consulta con menos de 3 caracteres", async () => {
    const fetchImpl = json({});
    expect(await suggestAddresses("al", { apiKey: "k", fetchImpl })).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("consulta Places restringido a Argentina y devuelve lugar y texto", async () => {
    const fetchImpl = json({
      suggestions: [
        {
          placePrediction: {
            placeId: "ChIJ1",
            structuredFormat: {
              mainText: { text: "Alsina 456" },
              secondaryText: { text: "Centro, Bahía Blanca" },
            },
          },
        },
        { placePrediction: { structuredFormat: { mainText: { text: "sin id" } } } },
      ],
    });
    const result = await suggestAddresses("Alsina 45", { apiKey: "secreta", fetchImpl });

    expect(result).toEqual([
      { placeId: "ChIJ1", main: "Alsina 456", secondary: "Centro, Bahía Blanca" },
    ]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://places.googleapis.com/v1/places:autocomplete");
    expect(JSON.parse(init.body as string)).toMatchObject({ includedRegionCodes: ["ar"] });
    expect((init.headers as Record<string, string>)["X-Goog-Api-Key"]).toBe("secreta");
  });

  it("si Google falla o no responde, devuelve vacío sin romper el checkout", async () => {
    expect(
      await suggestAddresses("Alsina 456", { apiKey: "k", fetchImpl: json({}, false) }),
    ).toEqual([]);
    const boom = vi.fn(async () => {
      throw new Error("timeout");
    });
    expect(await suggestAddresses("Alsina 456", { apiKey: "k", fetchImpl: boom })).toEqual([]);
  });

  it("sin clave solo ofrece direcciones simuladas en desarrollo", async () => {
    expect(await suggestAddresses("Alsina 456", {})).toEqual([]);
    const dev = await suggestAddresses("Alsina 456", { allowDevPlaces: true });
    expect(dev.length).toBeGreaterThan(0);
    expect(dev[0]?.placeId).toMatch(/^dev:/);
    expect(isMapsEnabled({})).toBe(false);
    expect(isMapsEnabled({ allowDevPlaces: true })).toBe(true);
  });
});

describe("drivingDistanceM", () => {
  const origin = { lat: -38.7, lng: -62.27 };

  it("pide a Routes la distancia por calle desde el local", async () => {
    const fetchImpl = json({ routes: [{ distanceMeters: 2430 }] });
    expect(await drivingDistanceM("ChIJ1", origin, { apiKey: "k", fetchImpl })).toBe(2430);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://routes.googleapis.com/directions/v2:computeRoutes");
    expect(JSON.parse(init.body as string)).toMatchObject({
      destination: { placeId: "ChIJ1" },
      travelMode: "DRIVE",
      origin: { location: { latLng: { latitude: -38.7, longitude: -62.27 } } },
    });
  });

  it("devuelve null (envío a confirmar) si no hay clave, local, ruta o respuesta válida", async () => {
    expect(await drivingDistanceM("ChIJ1", origin, {})).toBeNull();
    expect(await drivingDistanceM("ChIJ1", null, { apiKey: "k", fetchImpl: json({}) })).toBeNull();
    expect(
      await drivingDistanceM("ChIJ1", origin, { apiKey: "k", fetchImpl: json({ routes: [] }) }),
    ).toBeNull();
    expect(
      await drivingDistanceM("ChIJ1", origin, { apiKey: "k", fetchImpl: json({}, false) }),
    ).toBeNull();
  });

  it("las distancias simuladas solo existen en desarrollo", async () => {
    expect(await drivingDistanceM("dev:4500", null, { allowDevPlaces: true })).toBe(4500);
    expect(await drivingDistanceM("dev:4500", null, {})).toBeNull();
    expect(await drivingDistanceM("dev:abc", null, { allowDevPlaces: true })).toBeNull();
  });
});

describe("verifyTurnstile", () => {
  it("sin clave: en desarrollo pasa, en producción se rechaza", async () => {
    expect(await verifyTurnstile(undefined, "1.1.1.1", { production: false })).toEqual({
      ok: true,
    });
    expect(await verifyTurnstile(undefined, "1.1.1.1", { production: true })).toEqual({
      ok: false,
      reason: "NOT_CONFIGURED",
    });
  });

  it("con clave exige el token y lo valida contra Cloudflare", async () => {
    const options = { secret: "s", production: true };
    expect(await verifyTurnstile(undefined, undefined, options)).toEqual({
      ok: false,
      reason: "MISSING_TOKEN",
    });

    const ok = json({ success: true });
    expect(await verifyTurnstile("tok", "9.9.9.9", { ...options, fetchImpl: ok })).toEqual({
      ok: true,
    });
    const [, init] = ok.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.body as URLSearchParams).get("remoteip")).toBe("9.9.9.9");

    expect(
      await verifyTurnstile("tok", undefined, { ...options, fetchImpl: json({ success: false }) }),
    ).toEqual({
      ok: false,
      reason: "REJECTED",
    });
    expect(
      await verifyTurnstile("tok", undefined, { ...options, fetchImpl: json({}, false) }),
    ).toEqual({
      ok: false,
      reason: "UNAVAILABLE",
    });
  });
});

describe("createRateLimiter", () => {
  it("permite hasta el límite y avisa cuánto esperar", () => {
    let now = 0;
    const limiter = createRateLimiter(3, 60_000, () => now);

    expect(limiter.hit("ip")).toEqual({ allowed: true });
    now = 10_000;
    expect(limiter.hit("ip")).toEqual({ allowed: true });
    expect(limiter.hit("ip")).toEqual({ allowed: true });
    expect(limiter.hit("ip")).toEqual({ allowed: false, retryAfterSec: 50 });
  });

  it("libera la ventana con el tiempo y cuenta cada clave por separado", () => {
    let now = 0;
    const limiter = createRateLimiter(1, 1_000, () => now);

    expect(limiter.hit("a").allowed).toBe(true);
    expect(limiter.hit("a").allowed).toBe(false);
    expect(limiter.hit("b").allowed).toBe(true);
    now = 1_001;
    expect(limiter.hit("a").allowed).toBe(true);
  });
});
