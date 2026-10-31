import { Check } from "lucide-react";
import { Icon } from "@/components/ui";
import { ORDER_STATUSES, type OrderStatus } from "@/domain/orders";
import { STATUS_LABEL } from "@/lib/order-labels";

const STEPS = ORDER_STATUSES.filter((s) => s !== "CANCELADO");

/** Recorrido del pedido: lo hecho con tilde, el paso actual resaltado y lo que falta apagado. */
export function OrderStepper({ status }: { status: OrderStatus }) {
  const cancelled = status === "CANCELADO";
  const current = STEPS.findIndex((step) => step === status);
  return (
    <ol className="pasto-stepper" aria-label="Avance del pedido">
      {STEPS.map((step, index) => {
        const done = !cancelled && index < current;
        const active = !cancelled && index === current;
        return (
          <li
            key={step}
            className={done ? "is-done" : active ? "is-active" : undefined}
            aria-current={active ? "step" : undefined}
          >
            <span className="pasto-stepper__dot" aria-hidden="true">
              {done ? <Icon icon={Check} size={14} /> : index + 1}
            </span>
            <span className="pasto-stepper__label">{STATUS_LABEL[step]}</span>
          </li>
        );
      })}
    </ol>
  );
}
