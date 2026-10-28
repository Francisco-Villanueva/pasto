import { abandonAfterHoursFromSetting } from "./orders";

export type LatLng = { lat: number; lng: number };

export type StoreSettings = {
  /** Teléfono de WhatsApp Business, solo dígitos y con código de país. Sin él no se pueden tomar pedidos. */
  whatsapp: string | null;
  fudoUrl: string | null;
  storeAddress: string | null;
  /** Coordenadas del local: origen de la distancia de envío. */
  storeLocation: LatLng | null;
  maxDistanceM: number;
  defaultSlots: string[];
  abandonAfterHours: number | null;
};

export const DEFAULT_MAX_DISTANCE_M = 10_000;

const asText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value.trim() : null;

function asLatLng(value: unknown): LatLng | null {
  if (typeof value !== "object" || value === null) return null;
  const { lat, lng } = value as Record<string, unknown>;
  const valid = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
  return valid(lat) && valid(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    ? { lat, lng }
    : null;
}

/** Lee la tabla de ajustes (clave/valor). Lo que falta o es inválido queda como "sin configurar". */
export function parseStoreSettings(raw: Readonly<Record<string, unknown>>): StoreSettings {
  const whatsappText = asText(raw.pasto_whatsapp);
  const whatsapp = whatsappText && /^\+?\d{8,15}$/.test(whatsappText) ? whatsappText : null;

  const max = raw.delivery_max_distance_m;
  const slots = Array.isArray(raw.default_slots)
    ? raw.default_slots.filter((s): s is string => typeof s === "string" && s.trim() !== "")
    : [];

  return {
    whatsapp,
    fudoUrl: asText(raw.fudo_url),
    storeAddress: asText(raw.store_address),
    storeLocation: asLatLng(raw.store_location),
    maxDistanceM: typeof max === "number" && max > 0 ? max : DEFAULT_MAX_DISTANCE_M,
    defaultSlots: slots,
    abandonAfterHours: abandonAfterHoursFromSetting(raw.abandon_after_hours),
  };
}

/** El checkout solo se habilita con el WhatsApp de PASTO configurado. */
export function isCheckoutEnabled(settings: StoreSettings): boolean {
  return settings.whatsapp !== null;
}
