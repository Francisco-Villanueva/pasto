import type { PackItem } from "./packs";
import type { Macros } from "./store-catalog";

export const ZERO_MACROS: Macros = { calories: 0, protein: 0, carbs: 0, fats: 0 };

/** Macros totales de lo elegido: unidades de cada plato por sus macros. Platos sin macros no suman. */
export function sumMacros(
  items: readonly PackItem[],
  macrosByProduct: ReadonlyMap<string, Macros | null>,
): Macros {
  const total = { ...ZERO_MACROS };
  for (const item of items) {
    const macros = macrosByProduct.get(item.productId);
    if (!macros || item.quantity <= 0) continue;
    total.calories += macros.calories * item.quantity;
    total.protein += macros.protein * item.quantity;
    total.carbs += macros.carbs * item.quantity;
    total.fats += macros.fats * item.quantity;
  }
  return total;
}
