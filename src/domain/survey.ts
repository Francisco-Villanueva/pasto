import type { CrmTaskType } from "./crm";

export const PORTION_SIZES = ["MUY_CHICA", "ADECUADA", "MUY_GRANDE"] as const;
export type PortionSize = (typeof PORTION_SIZES)[number];

export const PORTION_LABEL: Record<PortionSize, string> = {
  MUY_CHICA: "Muy chica",
  ADECUADA: "Adecuada",
  MUY_GRANDE: "Muy grande",
};

export const MAX_COMMENT_LENGTH = 1000;

export type ReviewInput = {
  notTestedYet?: boolean;
  ratingOverall?: number | null;
  ratingFlavor?: number | null;
  ratingTexture?: number | null;
  portionSize?: string | null;
  comments?: string | null;
};

export type CleanReview = {
  notTestedYet: boolean;
  ratingOverall: number | null;
  ratingFlavor: number | null;
  ratingTexture: number | null;
  portionSize: PortionSize | null;
  comments: string | null;
};

export type ReviewIssue = "RATING_INVALID" | "PORTION_INVALID" | "COMMENT_TOO_LONG";

const validRating = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 5;

/**
 * Valida lo que el cliente manda de un plato. "Todavía no lo probé" descarta las notas (la base lo
 * exige); si no, cada nota es opcional (guardado parcial) pero tiene que ser un entero de 1 a 5.
 */
export function cleanReview(
  input: ReviewInput,
): { ok: true; review: CleanReview } | { ok: false; issue: ReviewIssue } {
  if (input.notTestedYet) {
    return {
      ok: true,
      review: {
        notTestedYet: true,
        ratingOverall: null,
        ratingFlavor: null,
        ratingTexture: null,
        portionSize: null,
        comments: null,
      },
    };
  }

  const ratings = [input.ratingOverall, input.ratingFlavor, input.ratingTexture];
  if (ratings.some((r) => r !== null && r !== undefined && !validRating(r))) {
    return { ok: false, issue: "RATING_INVALID" };
  }
  const portion = input.portionSize ?? null;
  if (portion !== null && !(PORTION_SIZES as readonly string[]).includes(portion)) {
    return { ok: false, issue: "PORTION_INVALID" };
  }
  const comments = input.comments?.trim() || null;
  if (comments && comments.length > MAX_COMMENT_LENGTH) {
    return { ok: false, issue: "COMMENT_TOO_LONG" };
  }

  return {
    ok: true,
    review: {
      notTestedYet: false,
      ratingOverall: input.ratingOverall ?? null,
      ratingFlavor: input.ratingFlavor ?? null,
      ratingTexture: input.ratingTexture ?? null,
      portionSize: portion as PortionSize | null,
      comments,
    },
  };
}

export type ReviewRow = {
  productId: string;
  productName: string;
  recipeVersion: string;
  ratingOverall: number | null;
  ratingFlavor: number | null;
  ratingTexture: number | null;
  portionSize: PortionSize | null;
  notTestedYet: boolean;
  comments: string | null;
};

export type ProductSummary = {
  productId: string;
  productName: string;
  recipeVersion: string;
  /** Cuántas personas lo calificaron (al menos una nota o la porción). */
  responses: number;
  notTested: number;
  avgOverall: number | null;
  avgFlavor: number | null;
  avgTexture: number | null;
  portions: Record<PortionSize, number>;
  comments: string[];
};

const average = (values: number[]): number | null =>
  values.length === 0
    ? null
    : Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;

/** Promedios por plato y versión de receta: una versión nueva arranca de cero. */
export function summarizeReviews(rows: readonly ReviewRow[]): ProductSummary[] {
  const groups = new Map<string, ReviewRow[]>();
  for (const row of rows) {
    const key = `${row.productId}|${row.recipeVersion}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  const nums = (list: ReviewRow[], pick: (r: ReviewRow) => number | null) =>
    list.map(pick).filter((v): v is number => v !== null);

  return [...groups.values()]
    .map((list): ProductSummary => {
      const answered = list.filter(
        (r) =>
          !r.notTestedYet &&
          (r.ratingOverall !== null ||
            r.ratingFlavor !== null ||
            r.ratingTexture !== null ||
            r.portionSize !== null),
      );
      const portions = { MUY_CHICA: 0, ADECUADA: 0, MUY_GRANDE: 0 };
      for (const r of answered) if (r.portionSize) portions[r.portionSize]++;

      return {
        productId: list[0]!.productId,
        productName: list[0]!.productName,
        recipeVersion: list[0]!.recipeVersion,
        responses: answered.length,
        notTested: list.filter((r) => r.notTestedYet).length,
        avgOverall: average(nums(list, (r) => r.ratingOverall)),
        avgFlavor: average(nums(list, (r) => r.ratingFlavor)),
        avgTexture: average(nums(list, (r) => r.ratingTexture)),
        portions,
        comments: list.flatMap((r) => (r.comments ? [r.comments] : [])),
      };
    })
    .sort(
      (a, b) =>
        a.productName.localeCompare(b.productName, "es") ||
        a.recipeVersion.localeCompare(b.recipeVersion),
    );
}

/**
 * Mensajes de seguimiento por WhatsApp. El de D+5 pregunta cómo les fue; el de D+12 invita a calificar
 * y lleva el link de la encuesta. Sin emojis y en rioplatense.
 */
export function buildFollowUpMessage(
  type: CrmTaskType,
  params: { customerName: string; surveyUrl: string },
): string {
  const firstName = params.customerName.trim().split(/\s+/)[0] || "";
  const hello = firstName
    ? `Hola ${firstName}, ¿cómo estás? Te escribimos de PASTO.`
    : "Hola, ¿cómo estás? Te escribimos de PASTO.";

  if (type === "D5_CHECKIN") {
    return [
      hello,
      "Pasaron unos días desde tu pedido y queríamos saber cómo te fue con los platos. ¿Los pudiste probar?",
      "Cualquier cosa que quieras contarnos nos ayuda mucho.",
    ].join("\n\n");
  }
  return [
    hello,
    "Si ya probaste tus platos, nos ayudaría mucho que los califiques. Lleva un par de minutos y no te pedimos ningún dato personal:",
    params.surveyUrl,
    "Gracias por elegirnos.",
  ].join("\n\n");
}
