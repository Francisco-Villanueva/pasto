import { z } from "zod";
import type { Cents } from "./money";

export const PRODUCT_CATEGORIES = ["ESENCIAL", "PROTEICO", "BURRITO", "COMPLEMENTO"] as const;

export const CATEGORY_LABEL = {
  ESENCIAL: "Esenciales",
  PROTEICO: "Proteicos",
  BURRITO: "Burritos",
  COMPLEMENTO: "Complementos",
} as const;

/** "21500", "21.500" o "21500,50" a centavos. null si no es un importe válido. */
export function parsePesos(text: string): Cents | null {
  const clean = text.trim().replace(/^\$/, "").replace(/\s/g, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(clean)) return null;
  const [whole = "0", fraction = ""] = clean.replace(/\./g, "").split(",");
  return Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
}

/** Centavos a lo que se escribe en el campo: "21500" o "21500,50". */
export function pesosField(cents: Cents | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  return fraction ? `${whole},${String(fraction).padStart(2, "0")}` : String(whole);
}

const optionalInt = (label: string, max: number) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      if (!/^\d+$/.test(v) || Number(v) > max) {
        ctx.addIssue({
          code: "custom",
          message: `${label} tiene que ser un número de 0 a ${max}.`,
        });
        return z.NEVER;
      }
      return Number(v);
    });

/** Lo que escribe la persona en el formulario de un plato. Todo llega como texto. */
export const productFormSchema = z
  .object({
    id: z.string().uuid().nullable(),
    name: z.string().trim().min(2, "Escribí el nombre del plato.").max(255),
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(
        /^[A-Z0-9][A-Z0-9_-]{1,63}$/,
        "El código usa letras, números, guiones y 2 a 64 caracteres.",
      ),
    category: z.enum(PRODUCT_CATEGORIES),
    description: z.string().trim().max(2000, "La descripción es demasiado larga."),
    ingredients: z.string().trim().max(2000, "Los ingredientes son demasiado largos."),
    allergens: z.string().trim().max(1000, "Los alérgenos son demasiado largos."),
    netWeightG: optionalInt("El peso", 5000),
    calories: optionalInt("Las calorías", 5000),
    protein: optionalInt("Las proteínas", 500),
    carbs: optionalInt("Los carbohidratos", 500),
    fats: optionalInt("Las grasas", 500),
    imageUrl: z
      .string()
      .trim()
      .max(1024)
      .refine(
        (v) => v === "" || /^https:\/\/[^\s]+$/.test(v),
        "La imagen tiene que ser un link https.",
      ),
    price: z.string().trim(),
    recipeVersion: z
      .string()
      .trim()
      .regex(/^v\d+(\.\d+){0,2}$/, "La versión de receta se escribe como v1.0."),
    isActive: z.boolean(),
  })
  .transform((v, ctx) => {
    const macroValues = [v.calories, v.protein, v.carbs, v.fats];
    const filled = macroValues.filter((m) => m !== null).length;
    if (filled > 0 && filled < 4) {
      ctx.addIssue({
        code: "custom",
        path: ["calories"],
        message: "Cargá los cuatro valores nutricionales o ninguno.",
      });
      return z.NEVER;
    }

    let priceCents: Cents | null = null;
    if (v.category === "COMPLEMENTO") {
      priceCents = parsePesos(v.price);
      if (priceCents === null || priceCents <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["price"],
          message: "Los complementos necesitan un precio mayor a cero.",
        });
        return z.NEVER;
      }
    }

    return {
      id: v.id,
      name: v.name,
      sku: v.sku,
      category: v.category,
      description: v.description,
      ingredients: v.ingredients,
      allergens: v.allergens,
      netWeightG: v.netWeightG,
      macros:
        filled === 4
          ? { calories: v.calories!, protein: v.protein!, carbs: v.carbs!, fats: v.fats! }
          : null,
      imageUrl: v.imageUrl === "" ? null : v.imageUrl,
      priceCents,
      recipeVersion: v.recipeVersion,
      isActive: v.isActive,
    };
  });

export type ProductInput = z.output<typeof productFormSchema>;
export type ProductFormValues = z.input<typeof productFormSchema>;

/**
 * Si cambian los ingredientes o la descripción conviene subir la versión de receta: las encuestas
 * arrancan de cero con cada versión. Devuelve el aviso, o null si no hace falta.
 */
export function recipeVersionWarning(
  before: { ingredients: string; description: string; recipeVersion: string },
  after: { ingredients: string; description: string; recipeVersion: string },
): string | null {
  const changed =
    before.ingredients.trim() !== after.ingredients.trim() ||
    before.description.trim() !== after.description.trim();
  if (!changed || before.recipeVersion !== after.recipeVersion) return null;
  return "Cambiaste los ingredientes o la descripción sin subir la versión de receta. Las encuestas siguen sumando al promedio anterior.";
}

/** Precio por tamaño de pack: un importe por tamaño, mayor a cero. */
export function parseTierPrices(
  entries: { id: string; price: string }[],
): { ok: true; tiers: { id: string; priceCents: Cents }[] } | { ok: false; message: string } {
  const tiers: { id: string; priceCents: Cents }[] = [];
  for (const entry of entries) {
    const priceCents = parsePesos(entry.price);
    if (priceCents === null || priceCents <= 0) {
      return { ok: false, message: "Todos los precios tienen que ser un importe mayor a cero." };
    }
    tiers.push({ id: entry.id, priceCents });
  }
  return { ok: true, tiers };
}
