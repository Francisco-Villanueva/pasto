"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@design/react";
import { useToast } from "@/components/ui";
import type { OrderStatus } from "@/domain/orders";
import { changeStatusAction } from "@/app/admin/(panel)/pedidos/actions";

/** Lo único que Cocina puede marcar: empezar a cocinar o dejar listo. El servidor lo vuelve a validar. */
export function KitchenActions({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const next =
    status === "CONFIRMADO"
      ? { to: "EN_PRODUCCION" as const, label: "Empezar" }
      : status === "EN_PRODUCCION"
        ? { to: "LISTO" as const, label: "Marcar listo" }
        : null;
  if (!next) return null;

  return (
    <div className="stack" style={{ gap: "var(--space-1)" }}>
      <Button
        small
        disabled={pending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await changeStatusAction({ orderId, to: next.to });
            if (result.ok) {
              toast("Estado actualizado");
              router.refresh();
            } else setError(result.message);
          });
        }}
      >
        {next.label}
      </Button>
      {error && (
        <span className="caption" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
