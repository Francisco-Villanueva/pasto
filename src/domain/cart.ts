import { isPlan, type Catalog, type Plan } from "./catalog";
import { validatePack, type PackDraft, type PackIssue } from "./packs";

export type CartPack = PackDraft & { id: string };
export type CartComplement = { productId: string; quantity: number };

export type Cart = {
  packs: readonly CartPack[];
  complements: readonly CartComplement[];
};

export const EMPTY_CART: Cart = { packs: [], complements: [] };

/** Planes (Esencial/Proteico) presentes en el carrito. Burritos y complementos no cuentan. */
export function plansInCart(cart: Cart): Set<Plan> {
  const plans = new Set<Plan>();
  for (const pack of cart.packs) if (isPlan(pack.category)) plans.add(pack.category);
  return plans;
}

export type AddPackResult =
  | { status: "added"; cart: Cart }
  | { status: "invalid"; issues: PackIssue[] }
  | {
      /** Hay que mostrar el modal: nunca se pisa el carrito en silencio. */
      status: "plan_conflict";
      /** Packs del otro plan que se quitarían si el cliente elige reemplazar. */
      conflictingPackIds: string[];
    };

function withPack(cart: Cart, pack: CartPack): Cart {
  return { ...cart, packs: [...cart.packs, pack] };
}

export function addPack(cart: Cart, pack: CartPack, catalog: Catalog): AddPackResult {
  const issues = validatePack(pack, catalog);
  if (issues.length > 0) return { status: "invalid", issues };

  if (isPlan(pack.category)) {
    const conflicting = cart.packs.filter(
      (existing) => isPlan(existing.category) && existing.category !== pack.category,
    );
    if (conflicting.length > 0) {
      return { status: "plan_conflict", conflictingPackIds: conflicting.map((p) => p.id) };
    }
  }

  return { status: "added", cart: withPack(cart, pack) };
}

/**
 * Respuesta del cliente al modal de plan incompatible.
 * - keep: el carrito queda como estaba y el pack nuevo no entra.
 * - replace: se quitan solo los packs del plan en conflicto; burritos y complementos se conservan.
 */
export function resolvePlanConflict(cart: Cart, pack: CartPack, choice: "keep" | "replace"): Cart {
  if (choice === "keep") return cart;
  const remaining = cart.packs.filter(
    (existing) => !(isPlan(existing.category) && existing.category !== pack.category),
  );
  return withPack({ ...cart, packs: remaining }, pack);
}

export function removePack(cart: Cart, packId: string): Cart {
  return { ...cart, packs: cart.packs.filter((pack) => pack.id !== packId) };
}

export type AddComplementResult =
  | { status: "added"; cart: Cart }
  | { status: "rejected"; reason: "NO_MAIN_PACK" | "NOT_A_COMPLEMENT" | "UNAVAILABLE" };

/** Los complementos no se compran solos: exigen al menos un pack de meal prep o burritos. */
export function addComplement(
  cart: Cart,
  productId: string,
  catalog: Catalog,
  quantity = 1,
): AddComplementResult {
  const product = catalog.get(productId);
  if (!product || !product.isActive) return { status: "rejected", reason: "UNAVAILABLE" };
  if (product.category !== "COMPLEMENTO") return { status: "rejected", reason: "NOT_A_COMPLEMENT" };
  if (cart.packs.length === 0) return { status: "rejected", reason: "NO_MAIN_PACK" };

  const existing = cart.complements.find((c) => c.productId === productId);
  const complements = existing
    ? cart.complements.map((c) =>
        c.productId === productId ? { ...c, quantity: c.quantity + quantity } : c,
      )
    : [...cart.complements, { productId, quantity }];
  return { status: "added", cart: { ...cart, complements } };
}

/** Quita unidades; al llegar a cero el complemento sale del carrito. */
export function removeComplement(cart: Cart, productId: string, quantity = 1): Cart {
  const complements = cart.complements
    .map((c) => (c.productId === productId ? { ...c, quantity: c.quantity - quantity } : c))
    .filter((c) => c.quantity > 0);
  return { ...cart, complements };
}

export type CartIssue =
  | { code: "EMPTY" }
  | { code: "MIXED_PLANS" }
  /** Complementos sin pack principal: bloquea el checkout sin borrar nada. */
  | { code: "ORPHAN_COMPLEMENTS" }
  | { code: "INVALID_COMPLEMENT"; productId: string }
  | { code: "PACK_ISSUE"; packId: string; issue: PackIssue };

/** Todo lo que impide pasar al checkout. El servidor corre esta misma validación. */
export function cartIssues(cart: Cart, catalog: Catalog): CartIssue[] {
  const issues: CartIssue[] = [];

  if (cart.packs.length === 0 && cart.complements.length === 0) issues.push({ code: "EMPTY" });
  if (plansInCart(cart).size > 1) issues.push({ code: "MIXED_PLANS" });
  if (cart.packs.length === 0 && cart.complements.length > 0) {
    issues.push({ code: "ORPHAN_COMPLEMENTS" });
  }

  for (const pack of cart.packs) {
    for (const issue of validatePack(pack, catalog)) {
      issues.push({ code: "PACK_ISSUE", packId: pack.id, issue });
    }
  }
  for (const complement of cart.complements) {
    const product = catalog.get(complement.productId);
    const valid =
      product?.isActive &&
      product.category === "COMPLEMENTO" &&
      Number.isInteger(complement.quantity) &&
      complement.quantity > 0;
    if (!valid) issues.push({ code: "INVALID_COMPLEMENT", productId: complement.productId });
  }

  return issues;
}

export function canCheckout(cart: Cart, catalog: Catalog): boolean {
  return cartIssues(cart, catalog).length === 0;
}
