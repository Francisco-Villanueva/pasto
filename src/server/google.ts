import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { buildGoogleAuthUrl, decodeJwtClaims, validateGoogleClaims } from "@/domain/google-oidc";
import type { GoogleIdentity } from "@/domain/google-oidc";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export function googleConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.AUTH_GOOGLE_ID;
  const clientSecret = process.env.AUTH_GOOGLE_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

/**
 * Sin credenciales de Google, en desarrollo se ofrece un ingreso de prueba. Nunca en producción:
 * ahí, sin credenciales, el botón directamente no aparece.
 */
export function isDevLogin(): boolean {
  return process.env.NODE_ENV !== "production" && googleConfig() === null;
}

export function isCustomerLoginEnabled(): boolean {
  return googleConfig() !== null || isDevLogin();
}

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const redirectUri = () => `${appUrl()}/api/cuenta/google/callback`;

const b64 = (bytes: Buffer) => bytes.toString("base64url");

/** Datos de un intento de ingreso: viajan en una cookie y se comparan al volver de Google. */
export function newLoginAttempt() {
  const verifier = b64(randomBytes(32));
  return {
    state: b64(randomBytes(16)),
    nonce: b64(randomBytes(16)),
    verifier,
    challenge: b64(createHash("sha256").update(verifier).digest()),
  };
}

export function authorizationUrl(attempt: ReturnType<typeof newLoginAttempt>): string | null {
  const config = googleConfig();
  if (!config) return null;
  return buildGoogleAuthUrl({
    clientId: config.clientId,
    redirectUri: redirectUri(),
    state: attempt.state,
    nonce: attempt.nonce,
    codeChallenge: attempt.challenge,
  });
}

/** Cambia el código por la identidad. null si algo no cierra (se muestra un mensaje genérico). */
export async function identityFromCode(
  code: string,
  attempt: { nonce: string; verifier: string },
  now: Date = new Date(),
): Promise<GoogleIdentity | null> {
  const config = googleConfig();
  if (!config) return null;

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
      code_verifier: attempt.verifier,
    }),
    cache: "no-store",
  }).catch(() => null);
  if (!response?.ok) return null;

  const body = (await response.json().catch(() => null)) as { id_token?: unknown } | null;
  if (typeof body?.id_token !== "string") return null;
  const claims = decodeJwtClaims(body.id_token);
  if (!claims) return null;

  const checked = validateGoogleClaims(claims, {
    clientId: config.clientId,
    nonce: attempt.nonce,
    now,
  });
  return checked.ok ? checked.identity : null;
}
