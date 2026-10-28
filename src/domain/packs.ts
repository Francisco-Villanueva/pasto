import { PACK_SIZES, type Catalog, type PackCategory } from "./catalog";

export type PackItem = { productId: string; quantity: number };

export type PackDraft = {
  category: PackCategory;
  size: number;
  items: readonly PackItem[];
};

export type PackIssue =
  | { code: "INVALID_SIZE" }
  | { code: "INCOMPLETE"; selected: number; size: number }
  | { code: "OVERFLOW"; selected: number; size: number }
  | { code: "INVALID_QUANTITY"; productId: string }
  | { code: "UNKNOWN_PRODUCT"; productId: string }
  | { code: "INACTIVE_PRODUCT"; productId: string }
  | { code: "WRONG_CATEGORY"; productId: string };

export function packUnits(items: readonly PackItem[]): number {
  return items.reduce((total, item) => total + item.quantity, 0);
}

/**
 * Un pack solo se puede agregar cuando la suma de unidades es igual al tamaño.
 * La distribución de sabores es libre (10 unidades del mismo plato es válido).
 */
export function validatePack(pack: PackDraft, catalog: Catalog): PackIssue[] {
  const issues: PackIssue[] = [];

  if (!PACK_SIZES[pack.category].includes(pack.size)) {
    issues.push({ code: "INVALID_SIZE" });
  }

  for (const item of pack.items) {
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      issues.push({ code: "INVALID_QUANTITY", productId: item.productId });
      continue;
    }
    const product = catalog.get(item.productId);
    if (!product) issues.push({ code: "UNKNOWN_PRODUCT", productId: item.productId });
    else if (!product.isActive)
      issues.push({ code: "INACTIVE_PRODUCT", productId: item.productId });
    else if (product.category !== pack.category) {
      issues.push({ code: "WRONG_CATEGORY", productId: item.productId });
    }
  }

  const selected = packUnits(pack.items.filter((item) => Number.isInteger(item.quantity)));
  if (selected < pack.size) issues.push({ code: "INCOMPLETE", selected, size: pack.size });
  if (selected > pack.size) issues.push({ code: "OVERFLOW", selected, size: pack.size });

  return issues;
}

export function isPackComplete(pack: PackDraft, catalog: Catalog): boolean {
  return validatePack(pack, catalog).length === 0;
}
