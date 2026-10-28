import { describe, expect, it } from "vitest";
import { SAMPLE_SHIPPING } from "./sample-catalog";
import { computeDeliveryFee } from "./shipping";

const config = { maxDistanceM: SAMPLE_SHIPPING.maxDistanceM, tiers: SAMPLE_SHIPPING.tiers };
const delivery = (distanceM: number | null) =>
  computeDeliveryFee({ deliveryType: "DELIVERY", distanceM }, config);

describe("computeDeliveryFee", () => {
  it("retiro en el local es $0, sin importar la distancia", () => {
    expect(computeDeliveryFee({ deliveryType: "RETIRO", distanceM: 50_000 }, config)).toEqual({
      status: "PICKUP",
      feeCents: 0,
    });
  });

  it("elige el primer tramo que cubre la distancia", () => {
    expect(delivery(1_200)).toMatchObject({ status: "CALCULATED", feeCents: 150_000 });
    expect(delivery(3_001)).toMatchObject({ status: "CALCULATED", feeCents: 250_000 });
    expect(delivery(9_999)).toMatchObject({ status: "CALCULATED", feeCents: 400_000 });
  });

  it("el límite de cada tramo es inclusivo", () => {
    expect(delivery(3_000)).toMatchObject({ feeCents: 150_000 });
    expect(delivery(10_000)).toMatchObject({ feeCents: 400_000 });
  });

  it("fuera del radio máximo no se entrega", () => {
    expect(delivery(10_001)).toEqual({ status: "OUT_OF_RANGE", feeCents: null });
  });

  it("sin distancia (dirección no ubicada) queda a confirmar", () => {
    expect(delivery(null)).toEqual({ status: "TO_CONFIRM", feeCents: null });
    expect(delivery(Number.NaN)).toEqual({ status: "TO_CONFIRM", feeCents: null });
    expect(delivery(-1)).toEqual({ status: "TO_CONFIRM", feeCents: null });
  });

  it("tramos que no cubren el radio no cobran de más: quedan a confirmar", () => {
    const short = { maxDistanceM: 10_000, tiers: [{ upToM: 3_000, feeCents: 150_000 }] };
    expect(computeDeliveryFee({ deliveryType: "DELIVERY", distanceM: 5_000 }, short)).toEqual({
      status: "TO_CONFIRM",
      feeCents: null,
    });
  });

  it("no depende del orden en que el admin cargó los tramos", () => {
    const shuffled = { ...config, tiers: [...config.tiers].reverse() };
    expect(
      computeDeliveryFee({ deliveryType: "DELIVERY", distanceM: 2_000 }, shuffled),
    ).toMatchObject({
      feeCents: 150_000,
    });
  });
});
