"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { canAccessPath, homeFor, safeNextPath } from "@/domain/permissions";
import { SESSION_COOKIE } from "@/server/auth/constants";
import { authenticate } from "@/server/auth/login";
import { createSession, destroySession } from "@/server/auth/sessions";
import { limiters } from "@/server/rate-limit";

export type LoginState = { error?: string; email?: string };

const credentials = z.object({
  email: z.string().trim().min(1).max(254),
  password: z.string().min(1).max(200),
});

async function ipFromHeaders(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Ingreso del staff. El mensaje de error no distingue entre email inexistente y contraseña incorrecta. */
export async function loginAction(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const submittedEmail = formData.get("email")?.toString() ?? "";
  const limit = limiters().login.hit(await ipFromHeaders());
  if (!limit.allowed) {
    return {
      email: submittedEmail,
      error: `Hiciste demasiados intentos. Probá de nuevo en ${Math.ceil(limit.retryAfterSec / 60)} minutos.`,
    };
  }

  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { email: submittedEmail, error: "Escribí tu email y tu contraseña." };

  const result = await authenticate(await getDb(), parsed.data);
  if (!result.ok) {
    return {
      email: submittedEmail,
      error:
        result.reason === "LOCKED"
          ? `Esta cuenta está bloqueada por varios intentos fallidos. Probá de nuevo en ${Math.ceil(result.retryAfterSec / 60)} minutos.`
          : "El email o la contraseña no son correctos.",
    };
  }

  const { token, expiresAt } = await createSession(await getDb(), result.user.id);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  const next = safeNextPath(formData.get("next")?.toString());
  redirect(next && canAccessPath(result.user.role, next) ? next : homeFor(result.user.role));
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  await destroySession(await getDb(), jar.get(SESSION_COOKIE)?.value);
  jar.delete(SESSION_COOKIE);
  redirect("/admin/login");
}
