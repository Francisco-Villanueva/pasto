import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { can, homeFor, type Capability } from "@/domain/permissions";
import { SESSION_COOKIE } from "./constants";
import { findSession } from "./sessions";
import type { StaffUser } from "./users";

/**
 * Capa de acceso: toda página, acción o ruta del backoffice pasa por acá. El `proxy` solo hace un
 * chequeo optimista (hay cookie); la verificación real de la sesión y del rol es esta.
 */
export const getStaffUser = cache(async (): Promise<StaffUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return findSession(await getDb(), token);
});

/** Para páginas y acciones: sin sesión va al login; sin permiso, a la pantalla de inicio de su rol. */
export async function requireStaff(capability?: Capability): Promise<StaffUser> {
  const user = await getStaffUser();
  if (!user) redirect("/admin/login");
  if (capability && !can(user.role, capability)) redirect(homeFor(user.role));
  return user;
}

export type ApiAuth = { ok: true; user: StaffUser } | { ok: false; response: Response };

/** Para rutas de la API: 401 sin sesión y 403 sin permiso, nunca una redirección. */
export async function authorizeApi(capability: Capability): Promise<ApiAuth> {
  const user = await getStaffUser();
  if (!user) {
    return {
      ok: false,
      response: Response.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 }),
    };
  }
  if (!can(user.role, capability)) {
    return {
      ok: false,
      response: Response.json({ error: { code: "FORBIDDEN" } }, { status: 403 }),
    };
  }
  return { ok: true, user };
}

export type ActionAuth = { ok: true; user: StaffUser } | { ok: false; message: string };

/**
 * Para acciones del servidor (formularios y botones): devuelve un mensaje en vez de redirigir, porque
 * la pantalla tiene que poder mostrarlo. Alcanza con tener UNA de las capacidades pedidas.
 */
export async function authorizeAction(...capabilities: Capability[]): Promise<ActionAuth> {
  const user = await getStaffUser();
  if (!user) return { ok: false, message: "Tu sesión venció. Volvé a ingresar." };
  if (!capabilities.some((capability) => can(user.role, capability))) {
    return { ok: false, message: "No tenés permiso para hacer esto." };
  }
  return { ok: true, user };
}
