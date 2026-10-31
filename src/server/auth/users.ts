import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import type { AppDb } from "@/db/types";
import type { StaffRole } from "@/domain/orders";
import { hashPassword, passwordProblem } from "./password";

export type StaffUser = {
  id: string;
  email: string;
  role: StaffRole;
  fullName: string | null;
};

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CreateStaffResult =
  | { ok: true; user: StaffUser }
  | { ok: false; error: "INVALID_EMAIL" | "WEAK_PASSWORD" | "EMAIL_TAKEN"; message: string };

/** Alta de un usuario del staff. Sirve para el script de línea de comandos y para la pantalla de usuarios. */
export async function createStaffUser(
  db: AppDb,
  input: { email: string; password: string; role: StaffRole; fullName?: string },
): Promise<CreateStaffResult> {
  const email = normalizeEmail(input.email);
  if (!EMAIL.test(email))
    return { ok: false, error: "INVALID_EMAIL", message: "El email no es válido." };

  const problem = passwordProblem(input.password);
  if (problem) return { ok: false, error: "WEAK_PASSWORD", message: problem };

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing)
    return { ok: false, error: "EMAIL_TAKEN", message: "Ya hay un usuario con ese email." };

  const [created] = await db
    .insert(users)
    .values({
      email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      fullName: input.fullName?.trim() || null,
    })
    .returning({ id: users.id, email: users.email, role: users.role, fullName: users.fullName });

  return { ok: true, user: created! };
}
