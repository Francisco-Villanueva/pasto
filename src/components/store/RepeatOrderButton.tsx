"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@design/react";
import { Notice } from "@/components/ui";
import { useCartStore } from "@/lib/cart-store";
import { repeatOrderAction } from "@/app/mi-cuenta/actions";

/** Carga en el carrito las mismas selecciones de un pedido anterior y avisa qué ya no está disponible. */
export function RepeatOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const setCart = useCartStore((state) => state.setCart);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[] | null>(null);

  function repeat() {
    setError(null);
    startTransition(async () => {
      const result = await repeatOrderAction(orderId);
      if (!result.ok) return setError(result.message);
      setCart(result.cart);
      if (result.unavailableNames.length === 0) router.push("/cart");
      else setMissing(result.unavailableNames);
    });
  }

  return (
    <div className="stack" style={{ gap: "var(--space-2)" }}>
      <Button small variant="secondary" disabled={pending} onClick={repeat}>
        Repetir pedido
      </Button>
      {error && (
        <Notice tone="brand" role="alert">
          {error}
        </Notice>
      )}
      {missing && (
        <Notice role="status">
          <span>
            Ya no tenemos: {[...new Set(missing)].join(", ")}. Armamos el carrito con el resto;
            elegí reemplazos antes de pedir.{" "}
            <Button small href="/cart">
              Ir al carrito
            </Button>
          </span>
        </Notice>
      )}
    </div>
  );
}
