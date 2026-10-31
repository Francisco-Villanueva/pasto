import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { safeCustomerNext } from "@/domain/google-oidc";
import {
  CUSTOMER_COOKIE,
  LOGIN_ATTEMPT_COOKIE,
  createCustomerSession,
  upsertCustomerAccount,
} from "@/server/customer-auth";
import { appUrl, identityFromCode } from "@/server/google";

const attemptSchema = z.object({
  state: z.string(),
  nonce: z.string(),
  verifier: z.string(),
  next: z.string(),
});

/** Vuelta de Google: valida el intento (state, nonce, PKCE), crea la sesión y manda al destino. */
export async function GET(request: NextRequest) {
  const fail = () => {
    const response = NextResponse.redirect(new URL("/mi-cuenta?error=google", appUrl()));
    response.cookies.delete({ name: LOGIN_ATTEMPT_COOKIE, path: "/api/cuenta/google" });
    return response;
  };

  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const raw = request.cookies.get(LOGIN_ATTEMPT_COOKIE)?.value;
  if (!code || !state || !raw) return fail();

  let attempt: z.infer<typeof attemptSchema>;
  try {
    attempt = attemptSchema.parse(JSON.parse(raw));
  } catch {
    return fail();
  }
  if (attempt.state !== state) return fail();

  const identity = await identityFromCode(code, attempt);
  if (!identity) return fail();

  const db = await getDb();
  const account = await upsertCustomerAccount(db, identity);
  const { token, expiresAt } = await createCustomerSession(db, account.id);

  const response = NextResponse.redirect(new URL(safeCustomerNext(attempt.next), appUrl()));
  response.cookies.delete({ name: LOGIN_ATTEMPT_COOKIE, path: "/api/cuenta/google" });
  response.cookies.set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return response;
}
