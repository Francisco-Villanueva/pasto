import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/server/auth/constants";

/**
 * Chequeo OPTIMISTA del backoffice: sin cookie de sesión, al login. No verifica que la sesión sea válida
 * ni el rol (eso lo hace la capa de acceso en cada página, acción y ruta); solo evita cargar de más.
 * También agrega encabezados de seguridad a todo `/admin`.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  let response: NextResponse;
  if (pathname !== "/admin/login" && !request.cookies.has(SESSION_COOKIE)) {
    const login = new URL("/admin/login", request.url);
    if (pathname !== "/admin") login.searchParams.set("next", pathname + search);
    response = NextResponse.redirect(login);
  } else {
    response = NextResponse.next();
  }

  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "same-origin");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = { matcher: ["/admin/:path*"] };
