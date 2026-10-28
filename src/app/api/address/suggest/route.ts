import { clientIp, jsonError } from "@/server/http";
import { mapsOptionsFromEnv, suggestAddresses } from "@/server/maps";
import { limiters } from "@/server/rate-limit";

/** Sugerencias de direcciones. La clave de Google queda en el servidor y el uso está limitado por IP. */
export async function GET(request: Request) {
  const limit = limiters().address.hit(clientIp(request));
  if (!limit.allowed) {
    return jsonError(
      429,
      "RATE_LIMITED",
      "Demasiadas búsquedas seguidas.",
      {},
      {
        "Retry-After": String(limit.retryAfterSec),
      },
    );
  }

  const query = new URL(request.url).searchParams.get("q") ?? "";
  const suggestions = await suggestAddresses(query.slice(0, 120), mapsOptionsFromEnv());
  return Response.json({ suggestions }, { headers: { "Cache-Control": "no-store" } });
}
