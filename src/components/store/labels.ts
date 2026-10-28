import type { PackCategory } from "@/domain/catalog";

export const CATEGORY_LABEL: Record<PackCategory, string> = {
  ESENCIAL: "Esencial",
  PROTEICO: "Proteico",
  BURRITO: "Burritos",
};

/** "Esencial x5", "Burritos x12". */
export function packLabel(category: PackCategory, size: number): string {
  return `${CATEGORY_LABEL[category]} x${size}`;
}
