"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@design/react";
import { Modal, Notice, SelectField, TextareaField, useToast } from "@/components/ui";
import type { OrderStatus } from "@/domain/orders";
import { PAYMENT_METHOD_LABEL, type TransitionKind } from "@/lib/order-labels";
import { changeStatusAction, updatePaymentAction } from "@/app/admin/(panel)/pedidos/actions";

type Action = { to: OrderStatus; label: string; kind: TransitionKind };

type Props = {
  orderId: string;
  actions: Action[];
  paymentMethod: keyof typeof PAYMENT_METHOD_LABEL;
  paymentStatus: "PENDIENTE" | "PAGADO";
};

/** Botones de estado y de pago de un pedido. Cada uno vuelve a validarse en el servidor. */
export function OrderActions({ orderId, actions, paymentMethod, paymentStatus }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState(paymentMethod);

  function run(task: () => Promise<{ ok: boolean; message?: string }>, success: string) {
    setError(null);
    startTransition(async () => {
      const result = await task();
      if (result.ok) {
        toast(success);
        setCancelOpen(false);
        setReason("");
        router.refresh();
      } else {
        setError(result.message ?? "No pudimos hacer el cambio.");
      }
    });
  }

  const changeStatus = (to: OrderStatus, why?: string) =>
    run(() => changeStatusAction({ orderId, to, reason: why }), "Estado actualizado");

  const primary = actions.find((a) => a.kind === "forward");
  const cancel = actions.find((a) => a.kind === "cancel");
  const others = actions.filter((a) => a !== primary && a !== cancel);

  return (
    <div className="stack">
      {error && (
        <Notice tone="brand" role="alert">
          {error}
        </Notice>
      )}

      <div className="stack" style={{ gap: "var(--space-2)", alignItems: "stretch" }}>
        {primary && (
          <Button disabled={pending} onClick={() => changeStatus(primary.to)}>
            {primary.label}
          </Button>
        )}
        {others.map((action) => (
          <Button
            key={action.to}
            variant={action.kind === "skip" ? "secondary" : "ghost"}
            disabled={pending}
            onClick={() => changeStatus(action.to)}
          >
            {action.label}
          </Button>
        ))}
        {cancel && (
          <Button variant="ghost" disabled={pending} onClick={() => setCancelOpen(true)}>
            {cancel.label}
          </Button>
        )}
        {actions.length === 0 && (
          <p className="body-sm muted">No hay cambios de estado disponibles.</p>
        )}
      </div>

      <hr style={{ width: "100%", border: 0, borderTop: "1.5px solid var(--border)" }} />

      <span className="label">PAGO</span>
      <SelectField
        label="Medio de pago"
        value={method}
        onChange={(event) => {
          const next = event.target.value as typeof method;
          setMethod(next);
          run(() => updatePaymentAction({ orderId, method: next }), "Medio de pago actualizado");
        }}
        disabled={pending}
      >
        {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </SelectField>
      {paymentStatus === "PENDIENTE" ? (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            run(() => updatePaymentAction({ orderId, status: "PAGADO" }), "Pago registrado")
          }
        >
          Marcar pago recibido
        </Button>
      ) : (
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() =>
            run(
              () => updatePaymentAction({ orderId, status: "PENDIENTE" }),
              "Pago marcado como pendiente",
            )
          }
        >
          Marcar pago como pendiente
        </Button>
      )}

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancelar el pedido">
        <p className="muted">El motivo es obligatorio y queda guardado en el historial.</p>
        <TextareaField
          label="Motivo"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          error={reason.trim() ? undefined : "Escribí el motivo de la cancelación."}
        />
        <div className="row">
          <Button
            disabled={!reason.trim() || pending}
            onClick={() => changeStatus("CANCELADO", reason)}
          >
            Cancelar pedido
          </Button>
          <Button variant="secondary" onClick={() => setCancelOpen(false)}>
            Volver
          </Button>
        </div>
      </Modal>
    </div>
  );
}
