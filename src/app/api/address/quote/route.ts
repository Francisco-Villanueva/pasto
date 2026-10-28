import { z } from "zod";
import { getDb, hasDatabase } from "@/db";
import { loadSettingsFromDb } from "@/db/catalog";
import { parseStoreSettings } from "@/domain/settings";
import { computeDeliveryFee } from "@/domain/shipping";
import { clientIp, jsonError } from "@/server/http";
import { drivingDistanceM, mapsOptionsFromEnv } from "@/server/maps";
import { limiters } from "@/server/rate-limit";
import { loadShippingConfig } from "@/server/shipping-config";

const bodySchema = z.object({ placeId: z.string().trim().min(1).max(300) });

/**
 * Cotiza el envío de un lugar para mostrarlo antes de pedir. Es solo informativo:
 * al crear el pedido el servidor vuelve a medir y a calcular.
 */
export async function POST(request: Request) {
  const limit = limiters().address.hit(clientIp(request));
  if (!limit.allowed) {
    return jsonError(
      429,
      "RATE_LIMITED",
      "Demasiadas consultas seguidas.",
      {},
      {
        "Retry-After": String(limit.retryAfterSec),
      },
    );
  }
  if (!hasDatabase()) return jsonError(503, "UNAVAILABLE", "No disponible.");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "BAD_REQUEST", "Falta el lugar.");

  const db = await getDb();
  const settings = parseStoreSettings(await loadSettingsFromDb(db));
  const distanceM = await drivingDistanceM(
    parsed.data.placeId,
    settings.storeLocation,
    mapsOptionsFromEnv(),
  );
  const fee = computeDeliveryFee(
    { deliveryType: "DELIVERY", distanceM },
    await loadShippingConfig(db, settings),
  );

  return Response.json(
    { status: fee.status, feeCents: fee.feeCents, distanceM },
    { headers: { "Cache-Control": "no-store" } },
  );
}
