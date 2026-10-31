export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSec: number };

export type RateLimiter = { hit: (key: string) => RateLimitResult };

/**
 * Ventana deslizante en memoria. Frena ráfagas desde una misma IP dentro de una instancia; como cada
 * instancia serverless tiene su propia memoria, NO es un límite global. El límite por teléfono sí es
 * global (se cuenta en la base) y, cuando haya Upstash, este limitador se reemplaza por uno compartido.
 */
export function createRateLimiter(
  limit: number,
  windowMs: number,
  now: () => number = Date.now,
): RateLimiter {
  const hits = new Map<string, number[]>();

  return {
    hit(key) {
      const current = now();
      const recent = (hits.get(key) ?? []).filter((t) => current - t < windowMs);

      if (recent.length >= limit) {
        hits.set(key, recent);
        return {
          allowed: false,
          retryAfterSec: Math.ceil((recent[0]! + windowMs - current) / 1000),
        };
      }

      recent.push(current);
      hits.set(key, recent);

      // Evita que el mapa crezca sin límite con IPs que no vuelven.
      if (hits.size > 5_000) {
        for (const [k, times] of hits) {
          if (times.every((t) => current - t >= windowMs)) hits.delete(k);
        }
      }
      return { allowed: true };
    },
  };
}

const globalForLimits = globalThis as unknown as {
  __pastoLimits?: {
    orders: RateLimiter;
    address: RateLimiter;
    login: RateLimiter;
    survey: RateLimiter;
  };
};

/** Limitadores compartidos por el proceso. Pedidos: 10 cada 10 min por IP. Direcciones: 40 por minuto. Ingreso del staff: 10 cada 15 min por IP. Encuesta: 60 guardados cada 10 min por IP. */
/** Sin tope: lo usa `dev:local` (Playwright entra decenas de veces desde la misma IP). Solo se respeta fuera de producción. */
const unlimited: RateLimiter = { hit: () => ({ allowed: true }) };

export function limiters() {
  if (process.env.DISABLE_RATE_LIMIT === "1" && process.env.NODE_ENV !== "production") {
    return { orders: unlimited, address: unlimited, login: unlimited, survey: unlimited };
  }
  globalForLimits.__pastoLimits ??= {
    orders: createRateLimiter(10, 10 * 60_000),
    address: createRateLimiter(40, 60_000),
    login: createRateLimiter(10, 15 * 60_000),
    survey: createRateLimiter(60, 10 * 60_000),
  };
  return globalForLimits.__pastoLimits;
}
