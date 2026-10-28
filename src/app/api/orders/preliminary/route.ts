import { getDb, hasDatabase } from "@/db";
import { describeDraftErrors } from "@/lib/checkout-errors";
import { checkoutSchema, fieldErrors } from "@/lib/checkout-schema";
import { clientIp, jsonError } from "@/server/http";
import { drivingDistanceM, mapsOptionsFromEnv } from "@/server/maps";
import { createPreliminaryOrder } from "@/server/orders";
import { limiters } from "@/server/rate-limit";
import { turnstileOptionsFromEnv, verifyTurnstile } from "@/server/turnstile";

/**
 * Crea un pedido PRELIMINAR y devuelve el enlace de WhatsApp con el mensaje armado.
 * No acepta precios: todo se recalcula en el servidor.
 */
export async function POST(request: Request) {
  const ip = clientIp(request);

  const limit = limiters().orders.hit(ip);
  if (!limit.allowed) {
    return jsonError(
      429,
      "RATE_LIMITED",
      "Hiciste muchos intentos seguidos. Esperá unos minutos y probá de nuevo.",
      {},
      { "Retry-After": String(limit.retryAfterSec) },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "BAD_REQUEST", "No pudimos leer tu pedido.");
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(422, "VALIDATION", "Revisá los datos del pedido.", {
      fields: fieldErrors(parsed.error),
    });
  }
  const input = parsed.data;

  const captcha = await verifyTurnstile(input.turnstileToken, ip, turnstileOptionsFromEnv());
  if (!captcha.ok) {
    return jsonError(
      captcha.reason === "NOT_CONFIGURED" ? 503 : 403,
      "CAPTCHA",
      captcha.reason === "NOT_CONFIGURED"
        ? "Los pedidos todavía no están habilitados."
        : "No pudimos verificar que sos una persona. Probá de nuevo.",
    );
  }

  if (!hasDatabase()) {
    return jsonError(503, "UNAVAILABLE", "Los pedidos todavía no están habilitados.");
  }

  const maps = mapsOptionsFromEnv();
  const result = await createPreliminaryOrder(await getDb(), input, {
    distanceFor: (placeId, settings) => drivingDistanceM(placeId, settings.storeLocation, maps),
  });

  if (result.ok) {
    return Response.json(
      {
        order_number: result.order.orderNumber,
        whatsapp_url: result.whatsappUrl,
        access_token: result.order.accessToken,
      },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  }

  switch (result.code) {
    case "CHECKOUT_DISABLED":
      return jsonError(503, "UNAVAILABLE", "Los pedidos todavía no están habilitados.");
    case "RATE_LIMITED":
      return jsonError(
        429,
        "RATE_LIMITED",
        "Ya hiciste varios pedidos en la última hora. Escribinos por WhatsApp si necesitás cambiar algo.",
      );
    case "INVALID_ORDER":
      return jsonError(422, "INVALID_ORDER", "Tu pedido necesita un ajuste.", {
        messages: describeDraftErrors(result.errors),
        codes: result.errors.map((error) => error.code),
      });
  }
}
