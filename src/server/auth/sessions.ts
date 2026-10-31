import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, lt } from "drizzle-orm";
import { staffSessions, users } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { SESSION_COOKIE } from "./constants";
import type { StaffUser } from "./users";

export { SESSION_COOKIE };

/** Las sesiones duran 12 horas (un turno de trabajo) y después hay que volver a ingresar. */
export const SESSION_TTL_MS = 12 * 3_600_000;

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/** Crea una sesión. Devuelve el token para la cookie; en la base queda solo su hash. */
export async function createSession(
  db: AppDb,
  userId: string,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  await db.insert(staffSessions).values({ userId, tokenHash: hashToken(token), expiresAt });
  // Limpieza de sesiones vencidas de esta persona, para que la tabla no crezca.
  await db
    .delete(staffSessions)
    .where(and(eq(staffSessions.userId, userId), lt(staffSessions.expiresAt, now)));

  return { token, expiresAt };
}

/** El usuario de una sesión vigente, o null si no existe, venció o la cuenta está desactivada. */
export async function findSession(
  db: AppDb,
  token: string | undefined,
  now: Date = new Date(),
): Promise<StaffUser | null> {
  if (!token || token.length < 20 || token.length > 100) return null;

  const [row] = await db
    .select({ id: users.id, email: users.email, role: users.role, fullName: users.fullName })
    .from(staffSessions)
    .innerJoin(users, eq(users.id, staffSessions.userId))
    .where(
      and(
        eq(staffSessions.tokenHash, hashToken(token)),
        gt(staffSessions.expiresAt, now),
        eq(users.isActive, true),
      ),
    )
    .limit(1);

  return row ?? null;
}

export async function destroySession(db: AppDb, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.delete(staffSessions).where(eq(staffSessions.tokenHash, hashToken(token)));
}

/** Cierra todas las sesiones de una persona (al desactivarla o cambiarle la contraseña). */
export async function destroyUserSessions(db: AppDb, userId: string): Promise<void> {
  await db.delete(staffSessions).where(eq(staffSessions.userId, userId));
}
