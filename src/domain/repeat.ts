import type { Catalog, PackCategory } from "./catalog";
import type { Cart, CartPack } from "./cart";

export type PreviousOrder = {
  items: readonly {
    category: PackCategory;
    tierSize: number;
    details: readonly { productId: string; quantity: number }[];
  }[];
  complements: readonly { productId: string; quantity: number }[];
};

export type RepeatResult = {
  cart: Cart;
  /** Platos o complementos que ya no están disponibles; el cliente tiene que reemplazarlos. */
  unavailableProductIds: string[];
};

/**
 * "Repetir pedido": arma un carrito nuevo con las selecciones anteriores.
 * No arrastra precios (se recalculan con el catálogo vigente) ni fecha (se pide una nueva).
 * Un pack con platos discontinuados vuelve incompleto, así el checkout lo bloquea hasta
 * que el cliente elija reemplazos.
 */
export function repeatOrder(
  previous: PreviousOrder,
  catalog: Catalog,
  newId: () => string = () => crypto.randomUUID(),
): RepeatResult {
  const unavailable = new Set<string>();
  const isAvailable = (productId: string) => {
    const available = catalog.get(productId)?.isActive === true;
    if (!available) unavailable.add(productId);
    return available;
  };

  const packs: CartPack[] = previous.items.map((item) => ({
    id: newId(),
    category: item.category,
    size: item.tierSize,
    items: item.details.filter((d) => isAvailable(d.productId)),
  }));

  const complements = previous.complements.filter((c) => isAvailable(c.productId));

  return { cart: { packs, complements }, unavailableProductIds: [...unavailable] };
}
