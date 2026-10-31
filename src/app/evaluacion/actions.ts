"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import { PORTION_SIZES } from "@/domain/survey";
import { limiters } from "@/server/rate-limit";
import { saveReview } from "@/server/survey";

export type SaveReviewActionResult = { ok: true } | { ok: false; message: string };

const rating = z.number().int().min(1).max(5).nullable().optional();

const input = z.object({
  token: z.string().max(64),
  productId: z.string().max(64),
  review: z.object({
    notTestedYet: z.boolean().optional(),
    ratingOverall: rating,
    ratingFlavor: rating,
    ratingTexture: rating,
    portionSize: z.enum(PORTION_SIZES).nullable().optional(),
    comments: z.string().max(2000).nullable().optional(),
  }),
});

const MESSAGES = {
  NOT_FOUND: "No encontramos esta encuesta.",
  EXPIRED: "Esta encuesta ya cerró.",
  DISH_NOT_IN_ORDER: "Ese plato no es parte de tu pedido.",
  RATING_INVALID: "Las notas van de 1 a 5.",
  PORTION_INVALID: "Elegí una porción de la lista.",
  COMMENT_TOO_LONG: "El comentario es demasiado largo.",
} as const;

/** Guarda la opinión de un plato. Pública: se abre con el token del pedido y tiene límite por IP. */
export async function saveReviewAction(raw: unknown): Promise<SaveReviewActionResult> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  if (!limiters().survey.hit(ip).allowed) {
    return {
      ok: false,
      message: "Guardaste muchas veces seguidas. Probá de nuevo en unos minutos.",
    };
  }

  const parsed = input.safeParse(raw);
  if (!parsed.success) return { ok: false, message: "Revisá los datos e intentá de nuevo." };

  const result = await saveReview(await getDb(), parsed.data);
  return result.ok ? { ok: true } : { ok: false, message: MESSAGES[result.code] };
}
