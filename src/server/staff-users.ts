import { and, asc, count, eq, ne } from "drizzle-orm";
import { users } from "@/db/schema";
import type { AppDb } from "@/db/types";
import type { StaffRole } from "@/domain/orders";
import { hashPassword, passwordProblem } from "@/server/auth/password";
import { destroyUserSessions } from "@/server/auth/sessions";

export type StaffUserRow = {
  id: string;
  email: string;
  fullName: string | null;
  role: StaffRole;
  isActive: boolean;
  lastLoginAt: Date | null;
};

export async function listStaffUsers(db: AppDb): Promise<StaffUserRow[]> {
  return db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      isActive: users.isActive,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .orderBy(asc(users.email));
}

export type StaffChangeCode = "NOT_FOUND" | "SELF" | "LAST_ADMIN" | "WEAK_PASSWORD";
export type StaffChangeResult =
  { ok: true } | { ok: false; code: StaffChangeCode; message?: string };

/** Cantidad de ADMIN activos que quedan sin contar a `exceptId`. */
async function otherActiveAdmins(db: AppDb, exceptId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(users)
    .where(and(eq(users.role, "ADMIN"), eq(users.isActive, true), ne(users.id, exceptId)));
  return row?.n ?? 0;
}

/**
 * Da de baja o reactiva a una persona. La baja cierra sus sesiones al instante. Nadie puede darse de
 * baja a sí mismo ni dejar al sistema sin un ADMIN activo.
 */
export async function setStaffActive(
  db: AppDb,
  input: { actorId: string; userId: string; active: boolean },
): Promise<StaffChangeResult> {
  const [target] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!target) return { ok: false, code: "NOT_FOUND" };

  if (!input.active) {
    if (target.id === input.actorId) return { ok: false, code: "SELF" };
    if (target.role === "ADMIN" && (await otherActiveAdmins(db, target.id)) === 0) {
      return { ok: false, code: "LAST_ADMIN" };
    }
  }

  await db.update(users).set({ isActive: input.active }).where(eq(users.id, target.id));
  if (!input.active) await destroyUserSessions(db, target.id);
  return { ok: true };
}

/** Cambia el rol. Misma protección: no se puede dejar al sistema sin un ADMIN activo. */
export async function setStaffRole(
  db: AppDb,
  input: { actorId: string; userId: string; role: StaffRole },
): Promise<StaffChangeResult> {
  const [target] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!target) return { ok: false, code: "NOT_FOUND" };
  if (target.role === input.role) return { ok: true };

  if (target.id === input.actorId) return { ok: false, code: "SELF" };
  if (
    target.role === "ADMIN" &&
    target.isActive &&
    (await otherActiveAdmins(db, target.id)) === 0
  ) {
    return { ok: false, code: "LAST_ADMIN" };
  }

  await db.update(users).set({ role: input.role }).where(eq(users.id, target.id));
  await destroyUserSessions(db, target.id);
  return { ok: true };
}

/** Nueva contraseña: cierra todas las sesiones de la persona y levanta un bloqueo por intentos fallidos. */
export async function resetStaffPassword(
  db: AppDb,
  input: { userId: string; password: string },
): Promise<StaffChangeResult> {
  const problem = passwordProblem(input.password);
  if (problem) return { ok: false, code: "WEAK_PASSWORD", message: problem };

  const updated = await db
    .update(users)
    .set({
      passwordHash: await hashPassword(input.password),
      failedLoginCount: 0,
      lockedUntil: null,
    })
    .where(eq(users.id, input.userId))
    .returning({ id: users.id });
  if (updated.length === 0) return { ok: false, code: "NOT_FOUND" };

  await destroyUserSessions(db, input.userId);
  return { ok: true };
}
