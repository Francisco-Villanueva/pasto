"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { authorizeAction } from "@/server/auth/dal";
import { resolveTask } from "@/server/crm";

export type CrmActionResult = { ok: true } | { ok: false; message: string };

const MESSAGES = {
  NOT_FOUND: "No encontramos la tarea.",
  ALREADY_RESOLVED: "Esa tarea ya estaba resuelta.",
  REASON_REQUIRED: "Escribí por qué la omitís.",
} as const;

/** Completa una tarea de seguimiento o la omite (con motivo). */
export async function resolveTaskAction(input: {
  taskId: string;
  outcome: "COMPLETADA" | "OMITIDA";
  notes?: string;
}): Promise<CrmActionResult> {
  const auth = await authorizeAction("CRM_VIEW");
  if (!auth.ok) return auth;

  const parsed = z
    .object({
      taskId: z.string().uuid(),
      outcome: z.enum(["COMPLETADA", "OMITIDA"]),
      notes: z.string().max(500).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Los datos no son válidos." };

  const result = await resolveTask(await getDb(), { ...parsed.data, actorId: auth.user.id });
  if (!result.ok) return { ok: false, message: MESSAGES[result.code] };

  revalidatePath("/admin/crm");
  return { ok: true };
}
