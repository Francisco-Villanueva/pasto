import type { Catalog, PackCategory, PriceTable, ProductCategory } from "./catalog";
import { tierKey } from "./catalog";
import type { Cents } from "./money";
import { SAMPLE_PRODUCTS, SAMPLE_TIERS } from "./sample-catalog";

export type Macros = { calories: number; protein: number; carbs: number; fats: number };

/** Producto tal como lo necesita la tienda. Es serializable: viaja del servidor al navegador. */
export type StoreProduct = {
  id: string;
  sku: string;
  name: string;
  category: ProductCategory;
  description: string;
  ingredients: string;
  allergens: string;
  netWeightG: number | null;
  macros: Macros | null;
  imageUrl: string | null;
  isActive: boolean;
  recipeVersion: string;
  /** Solo complementos: precio de un pack. */
  priceCents?: Cents;
};

export type StoreTier = { category: PackCategory; size: number; priceCents: Cents };

export type StoreCatalog = { products: StoreProduct[]; tiers: StoreTier[] };

export function toDomainCatalog(catalog: StoreCatalog): Catalog {
  return new Map(
    catalog.products.map((p) => [
      p.id,
      {
        id: p.id,
        name: p.name,
        category: p.category,
        isActive: p.isActive,
        priceCents: p.priceCents,
        recipeVersion: p.recipeVersion,
      },
    ]),
  );
}

export function toPriceTable(catalog: StoreCatalog): PriceTable {
  return new Map(catalog.tiers.map((t) => [tierKey(t.category, t.size), t.priceCents]));
}

/** Platos activos de una categoría, en el orden en que se cargaron. */
export function activeProducts(catalog: StoreCatalog, category: ProductCategory): StoreProduct[] {
  return catalog.products.filter((p) => p.category === category && p.isActive);
}

/** Precio más bajo de una categoría ("Desde $21.500"). */
export function startingPrice(catalog: StoreCatalog, category: PackCategory): Cents | null {
  const prices = catalog.tiers.filter((t) => t.category === category).map((t) => t.priceCents);
  return prices.length > 0 ? Math.min(...prices) : null;
}

const PLACEHOLDER = "a completar";

/**
 * ¿El texto es información real? Los alérgenos e ingredientes sin cargar (vacíos o "A completar")
 * no se muestran como si fueran datos: la tienda pide consultar.
 */
export function hasProductInfo(text: string | null | undefined): text is string {
  const value = text?.trim() ?? "";
  return value !== "" && value.toLowerCase() !== PLACEHOLDER;
}

/** Catálogo de ejemplo en memoria, con el id igual al SKU. Se usa mientras no haya base de datos. */
export function sampleStoreCatalog(): StoreCatalog {
  return {
    products: SAMPLE_PRODUCTS.map((p) => ({
      id: p.sku,
      sku: p.sku,
      name: p.name,
      category: p.category,
      description: "",
      ingredients: "A completar",
      allergens: "A completar",
      netWeightG: p.netWeightG,
      macros: p.macros,
      imageUrl: null,
      isActive: true,
      recipeVersion: "v1.0",
      priceCents: p.priceCents,
    })),
    tiers: SAMPLE_TIERS.map((t) => ({ ...t })),
  };
}
