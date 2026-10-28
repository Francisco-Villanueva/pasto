export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "NOT_CONFIGURED" | "MISSING_TOKEN" | "REJECTED" | "UNAVAILABLE" };

type Options = {
  secret?: string;
  /** En producción, sin clave configurada se rechaza: nunca se deja abierto el endpoint por descuido. */
  production: boolean;
  fetchImpl?: typeof fetch;
};

/** Verifica el captcha invisible de Cloudflare Turnstile. */
export async function verifyTurnstile(
  token: string | undefined,
  ip: string | undefined,
  { secret, production, fetchImpl = fetch }: Options,
): Promise<TurnstileResult> {
  if (!secret) return production ? { ok: false, reason: "NOT_CONFIGURED" } : { ok: true };
  if (!token) return { ok: false, reason: "MISSING_TOKEN" };

  try {
    const body = new URLSearchParams({ secret, response: token });
    if (ip) body.set("remoteip", ip);

    const response = await fetchImpl("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return { ok: false, reason: "UNAVAILABLE" };
    const data = (await response.json()) as { success?: boolean };
    return data.success ? { ok: true } : { ok: false, reason: "REJECTED" };
  } catch {
    return { ok: false, reason: "UNAVAILABLE" };
  }
}

export function turnstileOptionsFromEnv(): Pick<Options, "secret" | "production"> {
  return {
    secret: process.env.TURNSTILE_SECRET_KEY || undefined,
    production: process.env.NODE_ENV === "production",
  };
}
