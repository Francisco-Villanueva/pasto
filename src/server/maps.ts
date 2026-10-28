import type { LatLng } from "@/domain/settings";

export type AddressSuggestion = { placeId: string; main: string; secondary: string };

type FetchLike = typeof fetch;

type MapsOptions = {
  /** Clave de servidor de Google Maps. Sin ella, la búsqueda y la medición quedan desactivadas. */
  apiKey?: string;
  fetchImpl?: FetchLike;
  /** Solo en desarrollo: habilita direcciones simuladas para probar los tramos sin Google. */
  allowDevPlaces?: boolean;
};

const TIMEOUT_MS = 4_000;
const DEV_PREFIX = "dev:";

/** Direcciones simuladas (placeId `dev:<metros>`) para probar el envío por tramos sin clave de Google. */
const DEV_SUGGESTIONS: AddressSuggestion[] = [
  { placeId: "dev:1200", main: "Alsina 456", secondary: "Centro · 1,2 km (simulado)" },
  { placeId: "dev:4500", main: "Av. Colón 1800", secondary: "Palihue · 4,5 km (simulado)" },
  { placeId: "dev:9000", main: "Ruta 3 km 12", secondary: "Norte · 9 km (simulado)" },
  {
    placeId: "dev:15000",
    main: "Camino de la Carrindanga",
    secondary: "Fuera de zona · 15 km (simulado)",
  },
];

export function isMapsEnabled(options: MapsOptions): boolean {
  return Boolean(options.apiKey) || Boolean(options.allowDevPlaces);
}

/** Sugerencias de direcciones (Places Autocomplete, restringido a Argentina). Nunca lanza: devuelve []. */
export async function suggestAddresses(
  query: string,
  options: MapsOptions,
): Promise<AddressSuggestion[]> {
  const text = query.trim();
  if (text.length < 3) return [];

  if (!options.apiKey) {
    return options.allowDevPlaces
      ? DEV_SUGGESTIONS.filter(
          (s) => s.main.toLowerCase().includes(text.toLowerCase()) || text.length < 6,
        )
      : [];
  }

  try {
    const response = await (options.fetchImpl ?? fetch)(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": options.apiKey,
          "X-Goog-FieldMask":
            "suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat",
        },
        body: JSON.stringify({
          input: text,
          includedRegionCodes: ["ar"],
          languageCode: "es",
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!response.ok) return [];

    const data = (await response.json()) as {
      suggestions?: {
        placePrediction?: {
          placeId?: string;
          structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
        };
      }[];
    };

    return (data.suggestions ?? []).flatMap((s) => {
      const prediction = s.placePrediction;
      const main = prediction?.structuredFormat?.mainText?.text;
      if (!prediction?.placeId || !main) return [];
      return [
        {
          placeId: prediction.placeId,
          main,
          secondary: prediction.structuredFormat?.secondaryText?.text ?? "",
        },
      ];
    });
  } catch {
    return [];
  }
}

/**
 * Distancia por calle, en metros, del local a un lugar (Routes API). Nula si no se puede medir:
 * en ese caso el envío queda "a confirmar" y no se bloquea el pedido.
 */
export async function drivingDistanceM(
  placeId: string,
  origin: LatLng | null,
  options: MapsOptions,
): Promise<number | null> {
  if (options.allowDevPlaces && placeId.startsWith(DEV_PREFIX)) {
    const meters = Number(placeId.slice(DEV_PREFIX.length));
    return Number.isFinite(meters) && meters >= 0 ? meters : null;
  }
  if (!options.apiKey || !origin) return null;

  try {
    const response = await (options.fetchImpl ?? fetch)(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": options.apiKey,
          "X-Goog-FieldMask": "routes.distanceMeters",
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } },
          destination: { placeId },
          travelMode: "DRIVE",
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { routes?: { distanceMeters?: number }[] };
    const meters = data.routes?.[0]?.distanceMeters;
    return typeof meters === "number" && Number.isFinite(meters) && meters >= 0 ? meters : null;
  } catch {
    return null;
  }
}

/** Opciones de Maps según el entorno actual. */
export function mapsOptionsFromEnv(): MapsOptions {
  return {
    apiKey: process.env.GOOGLE_MAPS_SERVER_KEY || undefined,
    allowDevPlaces: process.env.NODE_ENV === "development",
  };
}
