"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { authorizeAction } from "@/server/auth/dal";
import { createStaffUser } from "@/server/auth/users";
import {
  resetStaffPassword,
  setStaffActive,
  setStaffRole,
  type StaffChangeResult,
} from "@/server/staff-users";

export type UsersActionResult = { ok: true } | { ok: false; message: string };

const roleSchema = z.enum(["ADMIN", "COCINA"]);
const idSchema = z.string().uuid();

const MESSAGES = {
  NOT_FOUND: "No encontramos a esa persona.",
  SELF: "No podés hacer este cambio sobre tu propio usuario.",
  LAST_ADMIN: "Tiene que quedar al menos un ADMIN activo.",
  WEAK_PASSWORD: "La contraseña no es válida.",
} as const;

function toResult(result: StaffChangeResult): UsersActionResult {
  if (result.ok) {
    revalidatePath("/admin/usuarios");
    return { ok: true };
  }
  return { ok: false, message: result.message ?? MESSAGES[result.code] };
}

export async function createUserAction(input: {
  email: string;
  fullName: string;
  role: string;
  password: string;
}): Promise<UsersActionResult> {
  const auth = await authorizeAction("USERS_MANAGE");
  if (!auth.ok) return auth;

  const parsed = z
    .object({
      email: z.string().max(255),
      fullName: z.string().max(120),
      role: roleSchema,
      password: z.string().max(200),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Revisá los datos e intentá de nuevo." };

  const result = await createStaffUser(await getDb(), parsed.data);
  if (!result.ok) return { ok: false, message: result.message };
  revalidatePath("/admin/usuarios");
  return { ok: true };
}

export async function setUserActiveAction(input: {
  userId: string;
  active: boolean;
}): Promise<UsersActionResult> {
  const auth = await authorizeAction("USERS_MANAGE");
  if (!auth.ok) return auth;
  const userId = idSchema.safeParse(input.userId);
  if (!userId.success) return { ok: false, message: MESSAGES.NOT_FOUND };

  return toResult(
    await setStaffActive(await getDb(), {
      actorId: auth.user.id,
      userId: userId.data,
      active: input.active === true,
    }),
  );
}

export async function setUserRoleAction(input: {
  userId: string;
  role: string;
}): Promise<UsersActionResult> {
  const auth = await authorizeAction("USERS_MANAGE");
  if (!auth.ok) return auth;
  const userId = idSchema.safeParse(input.userId);
  const role = roleSchema.safeParse(input.role);
  if (!userId.success || !role.success) return { ok: false, message: MESSAGES.NOT_FOUND };

  return toResult(
    await setStaffRole(await getDb(), {
      actorId: auth.user.id,
      userId: userId.data,
      role: role.data,
    }),
  );
}

export async function resetUserPasswordAction(input: {
  userId: string;
  password: string;
}): Promise<UsersActionResult> {
  const auth = await authorizeAction("USERS_MANAGE");
  if (!auth.ok) return auth;
  const userId = idSchema.safeParse(input.userId);
  if (!userId.success || typeof input.password !== "string") {
    return { ok: false, message: MESSAGES.NOT_FOUND };
  }

  return toResult(
    await resetStaffPassword(await getDb(), { userId: userId.data, password: input.password }),
  );
}
