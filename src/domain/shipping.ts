import type { Cents } from "./money";

export type ShippingTier = { upToM: number; feeCents: Cents };

export type ShippingConfig = {
  /** Más lejos que esto no se entrega. */
  maxDistanceM: number;
  tiers: readonly ShippingTier[];
};

export type DeliveryFee =
  | { status: "PICKUP"; feeCents: 0 }
  | { status: "CALCULATED"; feeCents: Cents; tierUpToM: number }
  /** No se pudo ubicar la dirección: el costo lo define Pasto por WhatsApp. */
  | { status: "TO_CONFIRM"; feeCents: null }
  | { status: "OUT_OF_RANGE"; feeCents: null };

/**
 * Costo de envío según la distancia por calle al local. Retiro es siempre $0.
 * Es la única función que conoce la fórmula: si más adelante se quiere otro modo
 * (base + precio por km), se cambia acá.
 */
export function computeDeliveryFee(
  input: { deliveryType: "DELIVERY" | "RETIRO"; distanceM: number | null },
  config: ShippingConfig,
): DeliveryFee {
  if (input.deliveryType === "RETIRO") return { status: "PICKUP", feeCents: 0 };

  const { distanceM } = input;
  if (distanceM === null || !Number.isFinite(distanceM) || distanceM < 0) {
    return { status: "TO_CONFIRM", feeCents: null };
  }
  if (distanceM > config.maxDistanceM) return { status: "OUT_OF_RANGE", feeCents: null };

  const tier = [...config.tiers]
    .sort((a, b) => a.upToM - b.upToM)
    .find((candidate) => distanceM <= candidate.upToM);
  // Tramos mal configurados (no cubren el radio): se confirma a mano antes que cobrar mal.
  if (!tier) return { status: "TO_CONFIRM", feeCents: null };

  return { status: "CALCULATED", feeCents: tier.feeCents, tierUpToM: tier.upToM };
}
