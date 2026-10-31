import { describe, expect, it } from "vitest";
import { buildFollowUpMessage, cleanReview, summarizeReviews, type ReviewRow } from "./survey";

describe("cleanReview", () => {
  it("acepta un guardado parcial: solo algunas notas", () => {
    const result = cleanReview({ ratingOverall: 4 });
    expect(result).toEqual({
      ok: true,
      review: {
        notTestedYet: false,
        ratingOverall: 4,
        ratingFlavor: null,
        ratingTexture: null,
        portionSize: null,
        comments: null,
      },
    });
  });

  it("'todavía no lo probé' descarta notas, porción y comentario", () => {
    const result = cleanReview({
      notTestedYet: true,
      ratingOverall: 5,
      portionSize: "ADECUADA",
      comments: "hola",
    });
    expect(result.ok && result.review).toMatchObject({
      notTestedYet: true,
      ratingOverall: null,
      portionSize: null,
      comments: null,
    });
  });

  it("rechaza notas fuera de 1 a 5, no enteras o porciones desconocidas", () => {
    expect(cleanReview({ ratingFlavor: 0 })).toEqual({ ok: false, issue: "RATING_INVALID" });
    expect(cleanReview({ ratingFlavor: 6 })).toEqual({ ok: false, issue: "RATING_INVALID" });
    expect(cleanReview({ ratingTexture: 3.5 })).toEqual({ ok: false, issue: "RATING_INVALID" });
    expect(cleanReview({ portionSize: "ENORME" })).toEqual({ ok: false, issue: "PORTION_INVALID" });
  });

  it("limpia el comentario y rechaza los demasiado largos", () => {
    const ok = cleanReview({ comments: "  muy rico  " });
    expect(ok.ok && ok.review.comments).toBe("muy rico");
    const blank = cleanReview({ comments: "   " });
    expect(blank.ok && blank.review.comments).toBeNull();
    expect(cleanReview({ comments: "x".repeat(1001) })).toEqual({
      ok: false,
      issue: "COMMENT_TOO_LONG",
    });
  });
});

const row = (over: Partial<ReviewRow>): ReviewRow => ({
  productId: "p1",
  productName: "Guiso",
  recipeVersion: "v1",
  ratingOverall: null,
  ratingFlavor: null,
  ratingTexture: null,
  portionSize: null,
  notTestedYet: false,
  comments: null,
  ...over,
});

describe("summarizeReviews", () => {
  it("promedia por plato, redondea a un decimal y cuenta porciones y no probados", () => {
    const [summary] = summarizeReviews([
      row({ ratingOverall: 5, ratingFlavor: 4, portionSize: "ADECUADA", comments: "Muy rico" }),
      row({ ratingOverall: 4, portionSize: "MUY_CHICA" }),
      row({ ratingOverall: 4 }),
      row({ notTestedYet: true }),
    ]);
    expect(summary).toMatchObject({
      responses: 3,
      notTested: 1,
      avgOverall: 4.3,
      avgFlavor: 4,
      avgTexture: null,
      portions: { MUY_CHICA: 1, ADECUADA: 1, MUY_GRANDE: 0 },
      comments: ["Muy rico"],
    });
  });

  it("separa las versiones de receta: la nueva arranca de cero", () => {
    const list = summarizeReviews([
      row({ ratingOverall: 2 }),
      row({ recipeVersion: "v2", ratingOverall: 5 }),
    ]);
    expect(list.map((s) => [s.recipeVersion, s.avgOverall])).toEqual([
      ["v1", 2],
      ["v2", 5],
    ]);
  });

  it("sin respuestas no inventa promedios", () => {
    const [summary] = summarizeReviews([row({ notTestedYet: true })]);
    expect(summary).toMatchObject({ responses: 0, avgOverall: null });
    expect(summarizeReviews([])).toEqual([]);
  });
});

describe("buildFollowUpMessage", () => {
  const params = { customerName: "Lucía Romero", surveyUrl: "https://pasto.test/evaluacion/abc" };

  it("D+5 pregunta cómo les fue y no lleva el link", () => {
    const text = buildFollowUpMessage("D5_CHECKIN", params);
    expect(text).toContain("Hola Lucía");
    expect(text).not.toContain("https://");
  });

  it("D+12 invita a calificar con el link de la encuesta", () => {
    const text = buildFollowUpMessage("D12_SURVEY", params);
    expect(text).toContain(params.surveyUrl);
    expect(text).toContain("PASTO");
  });

  it("sin nombre saluda igual", () => {
    expect(buildFollowUpMessage("D5_CHECKIN", { ...params, customerName: " " })).toMatch(
      /^Hola, ¿cómo estás\?/,
    );
  });
});
