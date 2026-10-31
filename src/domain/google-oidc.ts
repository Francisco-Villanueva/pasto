/** Reglas del ingreso con Google (OpenID Connect). Sin red ni base de datos: todo se puede probar. */

export const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"] as const;

/** Un ingreso a medias (el cliente fue a Google y no volvió) vence a los 10 minutos. */
export const LOGIN_ATTEMPT_TTL_SEC = 600;

export function buildGoogleAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
  nonce: string;
  codeChallenge: string;
}): string {
  const url = new URL(GOOGLE_AUTH_URL);
  url.search = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: params.state,
    nonce: params.nonce,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  return url.toString();
}

export type GoogleIdentity = { sub: string; email: string; name: string | null };

export type GoogleClaimsResult =
  | { ok: true; identity: GoogleIdentity }
  | { ok: false; code: "INVALID" | "EXPIRED" | "EMAIL_NOT_VERIFIED" };

/**
 * Valida los datos del id_token que Google entrega directo en el intercambio del código (por TLS, así
 * que no hace falta verificar la firma): emisor, destinatario, vencimiento, nonce y email verificado.
 * Solo un email verificado por Google sirve para reconocer pedidos hechos como invitado.
 */
export function validateGoogleClaims(
  claims: Record<string, unknown>,
  expected: { clientId: string; nonce: string; now: Date },
): GoogleClaimsResult {
  const { iss, aud, exp, nonce, sub, email, email_verified: verified, name } = claims;

  const audience = Array.isArray(aud) ? aud : [aud];
  if (typeof iss !== "string" || !(GOOGLE_ISSUERS as readonly string[]).includes(iss)) {
    return { ok: false, code: "INVALID" };
  }
  if (!audience.includes(expected.clientId)) return { ok: false, code: "INVALID" };
  if (nonce !== expected.nonce) return { ok: false, code: "INVALID" };
  if (typeof sub !== "string" || sub === "" || typeof email !== "string" || email === "") {
    return { ok: false, code: "INVALID" };
  }
  if (typeof exp !== "number" || exp * 1000 <= expected.now.getTime()) {
    return { ok: false, code: "EXPIRED" };
  }
  // Google manda el booleano o, en algunos casos, el texto "true".
  if (verified !== true && verified !== "true") return { ok: false, code: "EMAIL_NOT_VERIFIED" };

  return {
    ok: true,
    identity: {
      sub,
      email: email.trim().toLowerCase(),
      name: typeof name === "string" && name.trim() !== "" ? name.trim().slice(0, 255) : null,
    },
  };
}

/** Decodifica la parte de datos de un JWT sin verificar la firma. Devuelve null si está dañado. */
export function decodeJwtClaims(jwt: string): Record<string, unknown> | null {
  const part = jwt.split(".")[1];
  if (!part) return null;
  try {
    const json = JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
    return json && typeof json === "object" && !Array.isArray(json) ? json : null;
  } catch {
    return null;
  }
}

/** Destino seguro después de ingresar: solo rutas internas del sitio (evita redirecciones abiertas). */
export function safeCustomerNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return "/mi-cuenta";
  }
  return next;
}
