"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { EMPTY_CART, type Cart } from "@/domain/cart";
import { parseCart } from "./cart-persistence";

type CartState = {
  cart: Cart;
  setCart: (cart: Cart) => void;
  clear: () => void;
};

export const CART_STORAGE_KEY = "pasto-cart";

/**
 * Carrito del cliente, guardado en el navegador. Sin cuenta, persistente entre visitas.
 * Es solo una comodidad: el servidor revalida todo al crear el pedido.
 * `skipHydration` evita diferencias entre el HTML del servidor y el primer render del cliente;
 * se hidrata con `useCartReady`.
 */
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      cart: EMPTY_CART,
      setCart: (cart) => set({ cart }),
      clear: () => set({ cart: EMPTY_CART }),
    }),
    {
      name: CART_STORAGE_KEY,
      version: 1,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ cart: state.cart }),
      // Un carrito guardado con otro formato o dañado se descarta en lugar de romper la página.
      merge: (persisted, current) => ({
        ...current,
        cart: parseCart((persisted as { cart?: unknown } | undefined)?.cart),
      }),
    },
  ),
);

/**
 * Hidrata el carrito desde el navegador y lo mantiene sincronizado entre pestañas.
 * Devuelve `false` hasta que el carrito está listo, para no mostrar un carrito vacío por error.
 */
export function useCartReady(): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.resolve(useCartStore.persist.rehydrate()).then(() => {
      if (active) setReady(true);
    });

    const onStorage = (event: StorageEvent) => {
      if (event.key === CART_STORAGE_KEY) void useCartStore.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      active = false;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return ready;
}
