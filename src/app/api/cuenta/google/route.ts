import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db";
import { LOGIN_ATTEMPT_TTL_SEC, safeCustomerNext } from "@/domain/google-oidc";
import {
  CUSTOMER_COOKIE,
  LOGIN_ATTEMPT_COOKIE,
  createCustomerSession,
  upsertCustomerAccount,
} from "@/server/customer-auth";
import { authorizationUrl, appUrl, isDevLogin, newLoginAttempt } from "@/server/google";

const secure = process.env.NODE_ENV === "production";

/** Empieza el ingreso con Google. En desarrollo sin credenciales entra con un cliente de prueba. */
export async function GET(request: NextRequest) {
  const next = safeCustomerNext(request.nextUrl.searchParams.get("next"));

  if (isDevLogin()) {
    const db = await getDb();
    const account = await upsertCustomerAccount(db, {
      sub: "dev-cliente",
      email: "sofia.diaz@pasto.test",
      name: "Sofía Díaz",
    });
    const { token, expiresAt } = await createCustomerSession(db, account.id);
    const response = NextResponse.redirect(new URL(next, appUrl()));
    response.cookies.set(CUSTOMER_COOKIE, token, {
      httpOnly: true,
      secure,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
    return response;
  }

  const attempt = newLoginAttempt();
  const url = authorizationUrl(attempt);
  if (!url) return NextResponse.redirect(new URL("/mi-cuenta?error=google", appUrl()));

  const response = NextResponse.redirect(url);
  response.cookies.set(LOGIN_ATTEMPT_COOKIE, JSON.stringify({ ...attempt, next }), {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/api/cuenta/google",
    maxAge: LOGIN_ATTEMPT_TTL_SEC,
  });
  return response;
}
