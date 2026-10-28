import type { Cents } from "./money";

export const PLANS = ["ESENCIAL", "PROTEICO"] as const;
export type Plan = (typeof PLANS)[number];

/** Categorías que se arman como pack (con tamaño). */
export const PACK_CATEGORIES = ["ESENCIAL", "PROTEICO", "BURRITO"] as const;
export type PackCategory = (typeof PACK_CATEGORIES)[number];

export const PRODUCT_CATEGORIES = [...PACK_CATEGORIES, "COMPLEMENTO"] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PACK_SIZES: Record<PackCategory, readonly number[]> = {
  ESENCIAL: [5, 10, 20],
  PROTEICO: [5, 10, 20],
  BURRITO: [6, 12],
};

export type CatalogProduct = {
  id: string;
  name: string;
  category: ProductCategory;
  isActive: boolean;
  /** Solo para COMPLEMENTO: precio de un pack de complemento. */
  priceCents?: Cents;
  recipeVersion?: string;
};

/** Productos por id, tal como los lee el dominio. */
export type Catalog = ReadonlyMap<string, CatalogProduct>;

/** Precio por categoría y tamaño de pack: clave `${category}:${size}`. */
export type PriceTable = ReadonlyMap<string, Cents>;

export function tierKey(category: PackCategory, size: number): string {
  return `${category}:${size}`;
}

export function isPackCategory(category: ProductCategory): category is PackCategory {
  return (PACK_CATEGORIES as readonly string[]).includes(category);
}

export function isPlan(category: string): category is Plan {
  return (PLANS as readonly string[]).includes(category);
}
