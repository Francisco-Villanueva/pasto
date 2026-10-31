import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { verifyAgainstDummy, verifyPassword } from "./password";
import { normalizeEmail, type StaffUser } from "./users";

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

export type LoginResult =
  | { ok: true; user: StaffUser }
  /** Email o contraseña incorrectos, cuenta inexistente o desactivada: no se distingue a propósito. */
  | { ok: false; reason: "INVALID" }
  | { ok: false; reason: "LOCKED"; retryAfterSec: number };

/**
 * Valida email y contraseña. Tras 5 fallos seguidos la cuenta se bloquea 15 minutos (global, no por
 * instancia). Un email inexistente responde igual que una contraseña mala y tarda lo mismo.
 */
export async function authenticate(
  db: AppDb,
  credentials: { email: string; password: string },
  now: Date = new Date(),
): Promise<LoginResult> {
  const email = normalizeEmail(credentials.email);
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user || !user.isActive) {
    await verifyAgainstDummy(credentials.password);
    return { ok: false, reason: "INVALID" };
  }

  if (user.lockedUntil && user.lockedUntil.getTime() > now.getTime()) {
    return {
      ok: false,
      reason: "LOCKED",
      retryAfterSec: Math.ceil((user.lockedUntil.getTime() - now.getTime()) / 1000),
    };
  }

  if (!(await verifyPassword(user.passwordHash, credentials.password))) {
    const failed = user.failedLoginCount + 1;
    const lock = failed >= MAX_FAILED_ATTEMPTS;
    await db
      .update(users)
      .set({
        failedLoginCount: lock ? 0 : failed,
        lockedUntil: lock ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : user.lockedUntil,
      })
      .where(eq(users.id, user.id));
    return lock
      ? { ok: false, reason: "LOCKED", retryAfterSec: LOCK_MINUTES * 60 }
      : { ok: false, reason: "INVALID" };
  }

  await db
    .update(users)
    .set({ failedLoginCount: 0, lockedUntil: null, lastLoginAt: now })
    .where(eq(users.id, user.id));

  return {
    ok: true,
    user: { id: user.id, email: user.email, role: user.role, fullName: user.fullName },
  };
}
