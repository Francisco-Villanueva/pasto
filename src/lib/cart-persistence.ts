import { z } from "zod";
import { EMPTY_CART, type Cart } from "@/domain/cart";

const item = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
});

export const cartSchema = z.object({
  packs: z.array(
    z.object({
      id: z.string().min(1),
      category: z.enum(["ESENCIAL", "PROTEICO", "BURRITO"]),
      size: z.number().int().positive(),
      items: z.array(item),
    }),
  ),
  complements: z.array(item),
});

/** Lee un carrito guardado. Si el formato no es el esperado devuelve un carrito vacío. */
export function parseCart(value: unknown): Cart {
  const result = cartSchema.safeParse(value);
  return result.success ? result.data : EMPTY_CART;
}

/** Cantidad de productos en el carrito (packs y complementos), para el contador del encabezado. */
export function cartCount(cart: Cart): number {
  return cart.packs.length + cart.complements.reduce((total, c) => total + c.quantity, 0);
}
