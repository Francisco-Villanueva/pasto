"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { AGENDA_ISSUE_MESSAGE } from "@/domain/agenda";
import { saveGeneralSettings, saveShipping, updateDay } from "@/server/admin-agenda";
import type { AgendaResult } from "@/server/admin-agenda";
import { authorizeAction } from "@/server/auth/dal";

export type AgendaActionResult = { ok: true } | { ok: false; message: string };

const INVALID = { ok: false, message: "Los datos no son válidos." } as const;

function toResult(result: AgendaResult): AgendaActionResult {
  if (result.ok) {
    // La tienda y el editor de pedidos leen la agenda: se refrescan juntos.
    revalidatePath("/admin/agenda");
    revalidatePath("/carrito");
    return { ok: true };
  }
  return {
    ok: false,
    message:
      result.code === "NOT_FOUND"
        ? "Esa fecha ya no está en la agenda."
        : AGENDA_ISSUE_MESSAGE[result.code],
  };
}

const slotsSchema = z.array(z.string().max(200)).max(20);

export async function updateDayAction(input: {
  date: string;
  isOpen: boolean;
  slots: string[];
}): Promise<AgendaActionResult> {
  const auth = await authorizeAction("AGENDA_MANAGE");
  if (!auth.ok) return auth;

  const parsed = z
    .object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      isOpen: z.boolean(),
      slots: slotsSchema,
    })
    .safeParse(input);
  if (!parsed.success) return INVALID;

  return toResult(await updateDay(await getDb(), parsed.data));
}

export async function saveShippingAction(input: {
  tiers: { upToM: number; feeCents: number }[];
  maxDistanceM: number;
}): Promise<AgendaActionResult> {
  const auth = await authorizeAction("AGENDA_MANAGE");
  if (!auth.ok) return auth;

  const parsed = z
    .object({
      tiers: z.array(z.object({ upToM: z.number(), feeCents: z.number() })).max(50),
      maxDistanceM: z.number(),
    })
    .safeParse(input);
  if (!parsed.success) return INVALID;

  return toResult(await saveShipping(await getDb(), parsed.data));
}

export async function saveGeneralAction(input: {
  abandonAfterHours: number;
  defaultSlots: string[];
}): Promise<AgendaActionResult> {
  const auth = await authorizeAction("AGENDA_MANAGE");
  if (!auth.ok) return auth;

  const parsed = z
    .object({ abandonAfterHours: z.number(), defaultSlots: slotsSchema })
    .safeParse(input);
  if (!parsed.success) return INVALID;

  return toResult(await saveGeneralSettings(await getDb(), parsed.data));
}
