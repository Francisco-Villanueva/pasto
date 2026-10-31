import { eq } from "drizzle-orm";
import { packPricingTiers, products } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { numericFromCents } from "@/domain/money";
import type { ProductInput } from "@/domain/catalog-admin";

export type TierRow = { id: string; category: string; size: number; price: string };

export async function listTiers(db: AppDb): Promise<TierRow[]> {
  const rows = await db.select().from(packPricingTiers);
  return rows
    .filter((t) => t.category !== "COMPLEMENTO")
    .sort((a, b) => a.category.localeCompare(b.category) || a.size - b.size);
}

export type SaveProductResult =
  | { ok: true; id: string }
  | { ok: false; code: "NOT_FOUND" | "SKU_TAKEN" | "CATEGORY_LOCKED"; message: string };

/** Drizzle envuelve el error de Postgres: el código (23505) puede venir en `cause`. */
function isUniqueViolation(error: unknown): boolean {
  for (let e = error as { code?: string; cause?: unknown } | undefined, i = 0; e && i < 3; i++) {
    if (e.code === "23505") return true;
    e = e.cause as typeof e;
  }
  return false;
}

/**
 * Crea o edita un plato. La categoría no se puede cambiar después de crearlo: los pedidos viejos y
 * los packs armados dependen de ella. Para sacarlo de la venta se lo desactiva (nunca se borra).
 */
export async function saveProduct(db: AppDb, input: ProductInput): Promise<SaveProductResult> {
  const values = {
    sku: input.sku,
    name: input.name,
    description: input.description,
    ingredients: input.ingredients,
    allergens: input.allergens,
    netWeightG: input.netWeightG,
    macros: input.macros,
    imageUrl: input.imageUrl,
    price: input.priceCents === null ? null : numericFromCents(input.priceCents),
    recipeVersion: input.recipeVersion,
    isActive: input.isActive,
    updatedAt: new Date(),
  };

  try {
    if (input.id === null) {
      const [created] = await db
        .insert(products)
        .values({ ...values, category: input.category })
        .returning({ id: products.id });
      return { ok: true, id: created!.id };
    }

    const [current] = await db.select().from(products).where(eq(products.id, input.id)).limit(1);
    if (!current) return { ok: false, code: "NOT_FOUND", message: "No encontramos ese plato." };
    if (current.category !== input.category) {
      return {
        ok: false,
        code: "CATEGORY_LOCKED",
        message: "La categoría no se puede cambiar. Creá un plato nuevo y desactivá este.",
      };
    }
    await db.update(products).set(values).where(eq(products.id, input.id));
    return { ok: true, id: input.id };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, code: "SKU_TAKEN", message: "Ya hay un plato con ese código." };
    }
    throw error;
  }
}

export async function setProductActive(
  db: AppDb,
  input: { id: string; active: boolean },
): Promise<boolean> {
  const updated = await db
    .update(products)
    .set({ isActive: input.active, updatedAt: new Date() })
    .where(eq(products.id, input.id))
    .returning({ id: products.id });
  return updated.length > 0;
}

/** Actualiza el precio de cada tramo. Los pedidos ya hechos conservan el precio con el que se armaron. */
export async function saveTierPrices(
  db: AppDb,
  tiers: { id: string; priceCents: number }[],
): Promise<boolean> {
  let all = true;
  for (const tier of tiers) {
    const updated = await db
      .update(packPricingTiers)
      .set({ price: numericFromCents(tier.priceCents) })
      .where(eq(packPricingTiers.id, tier.id))
      .returning({ id: packPricingTiers.id });
    if (updated.length === 0) all = false;
  }
  return all;
}
