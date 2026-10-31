import { ORDER_STATUSES, type OrderStatus } from "@/domain/orders";

export const PAYMENT_METHOD_LABEL = {
  PENDIENTE: "A definir",
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
} as const;

export const STATUS_LABEL: Record<OrderStatus, string> = {
  PRELIMINAR: "Preliminar",
  PENDIENTE_CONFIRMACION: "Pendiente de confirmación",
  CONFIRMADO: "Confirmado",
  EN_PRODUCCION: "En producción",
  LISTO: "Listo",
  ENTREGADO: "Entregado",
  CANCELADO: "Cancelado",
};

const FLOW = ORDER_STATUSES.filter((s) => s !== "CANCELADO");

export type TransitionKind = "forward" | "skip" | "back" | "cancel" | "reactivate";

/** Cómo se ve un cambio de estado para quien lo hace: qué dice el botón y qué tan importante es. */
export function describeTransition(
  from: OrderStatus,
  to: OrderStatus,
): { label: string; kind: TransitionKind } {
  if (to === "CANCELADO") return { label: "Cancelar con motivo", kind: "cancel" };
  if (from === "CANCELADO")
    return { label: `Reactivar como ${STATUS_LABEL[to].toLowerCase()}`, kind: "reactivate" };

  const step = FLOW.indexOf(to) - FLOW.indexOf(from);
  if (step < 0) return { label: `Volver a ${STATUS_LABEL[to].toLowerCase()}`, kind: "back" };

  const forwardLabel: Partial<Record<OrderStatus, string>> = {
    PENDIENTE_CONFIRMACION: "Marcar pendiente de confirmación",
    CONFIRMADO: "Confirmar pedido",
    EN_PRODUCCION: "Pasar a producción",
    LISTO: "Marcar listo",
    ENTREGADO: "Marcar entregado",
  };
  return { label: forwardLabel[to] ?? STATUS_LABEL[to], kind: step === 1 ? "forward" : "skip" };
}

export type ChangeView = { title: string; lines: string[] };

/** Cómo se muestra una línea del historial: un título corto y, si hay, el detalle en líneas. */
export function describeChange(change: {
  kind: "ESTADO" | "EDICION" | "PAGO";
  note: string | null;
  before: unknown;
  after: unknown;
}): ChangeView {
  if (change.kind === "EDICION") {
    return { title: "Editó el pedido", lines: change.note ? change.note.split("\n") : [] };
  }

  if (change.kind === "PAGO") {
    const after = change.after as {
      method?: keyof typeof PAYMENT_METHOD_LABEL;
      status?: string;
    } | null;
    const method = after?.method ? PAYMENT_METHOD_LABEL[after.method] : "";
    const paid = after?.status === "PAGADO" ? "pagado" : "pago pendiente";
    return { title: `Pago: ${method.toLowerCase()} · ${paid}`, lines: [] };
  }

  const to = (change.after as { status?: OrderStatus } | null)?.status;
  const hasBefore = change.before !== null && change.before !== undefined;
  // La creación no tiene "antes": su nota ya dice cómo se creó.
  if (!hasBefore && change.note) return { title: change.note, lines: [] };
  return {
    title: to ? `Pasó a ${STATUS_LABEL[to].toLowerCase()}` : "Cambió de estado",
    lines: change.note ? [`Motivo: ${change.note}`] : [],
  };
}

/**
 * Acciones de estado de un pedido, ordenadas: el paso siguiente primero (la acción principal),
 * después los saltos, las vueltas atrás y, al final, cancelar.
 */
export function orderActions(
  from: OrderStatus,
  targets: readonly OrderStatus[],
): { to: OrderStatus; label: string; kind: TransitionKind }[] {
  const rank: Record<TransitionKind, number> = {
    forward: 0,
    skip: 1,
    reactivate: 2,
    back: 3,
    cancel: 4,
  };
  return targets
    .map((to) => ({ to, ...describeTransition(from, to) }))
    .sort((a, b) => rank[a.kind] - rank[b.kind]);
}
