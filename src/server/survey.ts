import { and, eq, ne } from "drizzle-orm";
import { orderItemDetails, orderItems, orders, productReviews } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { isSurveyOpen } from "@/domain/crm";
import {
  cleanReview,
  summarizeReviews,
  type PortionSize,
  type ProductSummary,
  type ReviewInput,
  type ReviewIssue,
  type ReviewRow,
} from "@/domain/survey";
import { products } from "@/db/schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SurveyDish = {
  productId: string;
  name: string;
  review: {
    notTestedYet: boolean;
    ratingOverall: number | null;
    ratingFlavor: number | null;
    ratingTexture: number | null;
    portionSize: PortionSize | null;
    comments: string;
  };
};

export type Survey =
  /** Sin pedido, o el pedido todavía no se entregó: no se distingue para no filtrar información. */
  { state: "NOT_FOUND" } | { state: "EXPIRED" } | { state: "OPEN"; dishes: SurveyDish[] };

/**
 * Platos de la encuesta de un pedido, con lo que ya se respondió. Solo los platos de los packs (los
 * complementos no se califican). Devuelve los datos mínimos: ni nombre del cliente ni importes.
 */
export async function loadSurvey(db: AppDb, token: string, now: Date): Promise<Survey> {
  if (!UUID.test(token)) return { state: "NOT_FOUND" };
  const [order] = await db
    .select({ id: orders.id, deliveredAt: orders.deliveredAt, status: orders.status })
    .from(orders)
    .where(eq(orders.surveyToken, token));
  if (!order || order.status !== "ENTREGADO" || !order.deliveredAt) return { state: "NOT_FOUND" };
  if (!isSurveyOpen(order.deliveredAt, now)) return { state: "EXPIRED" };

  const [dishRows, reviewRows] = await Promise.all([
    db
      .selectDistinct({ productId: orderItemDetails.productId, name: orderItemDetails.productName })
      .from(orderItemDetails)
      .innerJoin(orderItems, eq(orderItems.id, orderItemDetails.orderItemId))
      .where(and(eq(orderItems.orderId, order.id), ne(orderItems.itemType, "COMPLEMENTO"))),
    db.select().from(productReviews).where(eq(productReviews.orderId, order.id)),
  ]);
  const byProduct = new Map(reviewRows.map((r) => [r.productId, r]));

  const dishes = dishRows
    .map((d): SurveyDish => {
      const r = byProduct.get(d.productId);
      return {
        productId: d.productId,
        name: d.name,
        review: {
          notTestedYet: r?.notTestedYet ?? false,
          ratingOverall: r?.ratingOverall ?? null,
          ratingFlavor: r?.ratingFlavor ?? null,
          ratingTexture: r?.ratingTexture ?? null,
          portionSize: r?.portionSize ?? null,
          comments: r?.comments ?? "",
        },
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return { state: "OPEN", dishes };
}

export type SaveReviewResult =
  { ok: true } | { ok: false; code: "NOT_FOUND" | "EXPIRED" | "DISH_NOT_IN_ORDER" | ReviewIssue };

/** Guarda (o actualiza) la opinión de un plato. Permite guardar de a poco y volver a editar. */
export async function saveReview(
  db: AppDb,
  params: { token: string; productId: string; review: ReviewInput; now?: Date },
): Promise<SaveReviewResult> {
  const now = params.now ?? new Date();
  if (!UUID.test(params.token) || !UUID.test(params.productId)) {
    return { ok: false, code: "NOT_FOUND" };
  }

  const clean = cleanReview(params.review);
  if (!clean.ok) return { ok: false, code: clean.issue };

  const [order] = await db
    .select({ id: orders.id, deliveredAt: orders.deliveredAt, status: orders.status })
    .from(orders)
    .where(eq(orders.surveyToken, params.token));
  if (!order || order.status !== "ENTREGADO" || !order.deliveredAt) {
    return { ok: false, code: "NOT_FOUND" };
  }
  if (!isSurveyOpen(order.deliveredAt, now)) return { ok: false, code: "EXPIRED" };

  // La versión de receta sale del pedido (foto del momento de la compra), nunca del navegador.
  const [dish] = await db
    .select({ recipeVersion: orderItemDetails.recipeVersion })
    .from(orderItemDetails)
    .innerJoin(orderItems, eq(orderItems.id, orderItemDetails.orderItemId))
    .where(
      and(
        eq(orderItems.orderId, order.id),
        eq(orderItemDetails.productId, params.productId),
        ne(orderItems.itemType, "COMPLEMENTO"),
      ),
    )
    .limit(1);
  if (!dish) return { ok: false, code: "DISH_NOT_IN_ORDER" };

  await db
    .insert(productReviews)
    .values({
      orderId: order.id,
      productId: params.productId,
      recipeVersion: dish.recipeVersion,
      ...clean.review,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [productReviews.orderId, productReviews.productId],
      set: { ...clean.review, updatedAt: now },
    });
  return { ok: true };
}

/** Promedios por plato y versión de receta, para la pantalla de encuestas del admin. */
export async function loadSurveySummaries(db: AppDb): Promise<ProductSummary[]> {
  const rows = await db
    .select({
      productId: productReviews.productId,
      productName: products.name,
      recipeVersion: productReviews.recipeVersion,
      ratingOverall: productReviews.ratingOverall,
      ratingFlavor: productReviews.ratingFlavor,
      ratingTexture: productReviews.ratingTexture,
      portionSize: productReviews.portionSize,
      notTestedYet: productReviews.notTestedYet,
      comments: productReviews.comments,
    })
    .from(productReviews)
    .innerJoin(products, eq(products.id, productReviews.productId));
  return summarizeReviews(rows satisfies ReviewRow[]);
}
