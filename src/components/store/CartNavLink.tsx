"use client";

import { NavLink } from "@/components/layout/NavLink";
import { cartCount } from "@/lib/cart-persistence";
import { useCartReady, useCartStore } from "@/lib/cart-store";

/** Enlace al carrito con la cantidad de productos. No muestra nada hasta leer el carrito guardado. */
export function CartNavLink() {
  const ready = useCartReady();
  const count = useCartStore((state) => cartCount(state.cart));

  return (
    <NavLink href="/cart">
      Carrito
      {ready && count > 0 && (
        <>
          <span key={count} className="pasto-count" aria-hidden="true">
            {count}
          </span>
          <span className="sr-only">
            {" "}
            ({count} {count === 1 ? "producto" : "productos"})
          </span>
        </>
      )}
    </NavLink>
  );
}
