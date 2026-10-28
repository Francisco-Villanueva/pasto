import type { ReactNode } from "react";
import { Tag } from "@design/react";
import type { OrderStatus } from "@/domain/orders";
import { cx } from "./cx";

type DotTone = "terracota" | "cobre" | "verde" | "carbon" | "hollow" | "muted";

export function StatusDot({ tone = "muted" }: { tone?: DotTone }) {
  return (
    <span
      className={cx("pasto-dot", tone !== "muted" && `pasto-dot--${tone}`)}
      aria-hidden="true"
    />
  );
}

/** Punto y rótulo: el estado nunca se marca solo con color. */
export function Status({
  tone,
  tag = "outline",
  children,
}: {
  tone: DotTone;
  tag?: "brand" | "neutral" | "outline";
  children: ReactNode;
}) {
  return (
    <span className="pasto-status">
      <StatusDot tone={tone} />
      <Tag tone={tag}>{children}</Tag>
    </span>
  );
}

const ORDER_STATUS: Record<
  OrderStatus,
  { label: string; tone: DotTone; tag: "brand" | "neutral" | "outline" }
> = {
  PRELIMINAR: { label: "Preliminar", tone: "hollow", tag: "outline" },
  PENDIENTE_CONFIRMACION: { label: "Pendiente de confirmación", tone: "terracota", tag: "neutral" },
  CONFIRMADO: { label: "Confirmado", tone: "verde", tag: "brand" },
  EN_PRODUCCION: { label: "En producción", tone: "cobre", tag: "brand" },
  LISTO: { label: "Listo", tone: "verde", tag: "brand" },
  ENTREGADO: { label: "Entregado", tone: "carbon", tag: "outline" },
  CANCELADO: { label: "Cancelado", tone: "hollow", tag: "outline" },
};

export function orderStatusLabel(status: OrderStatus): string {
  return ORDER_STATUS[status].label;
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, tone, tag } = ORDER_STATUS[status];
  return (
    <Status tone={tone} tag={tag}>
      {label}
    </Status>
  );
}

export function PaymentBadge({ status }: { status: "PENDIENTE" | "PAGADO" }) {
  return (
    <Tag tone={status === "PAGADO" ? "brand" : "outline"}>
      {status === "PAGADO" ? "Pagado" : "Pago pendiente"}
    </Tag>
  );
}
