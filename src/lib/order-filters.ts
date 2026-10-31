import { ORDER_STATUSES, type OrderStatus } from "@/domain/orders";
import type { OrderFilters } from "@/server/admin-orders";

type Params = Record<string, string | string[] | undefined>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Filtros del listado a partir de la URL. Lo que no es válido se ignora: nadie puede romper la
 * consulta con un parámetro raro.
 */
export function parseOrderFilters(params: Params): OrderFilters {
  const date = first(params.fecha);
  const status = first(params.estado);
  const delivery = first(params.entrega);
  const payment = first(params.pago);
  const q = first(params.q)?.trim().slice(0, 80);
  const page = Number(first(params.pagina));

  return {
    date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
    status: (ORDER_STATUSES as readonly string[]).includes(status ?? "")
      ? (status as OrderStatus)
      : undefined,
    deliveryType: delivery === "DELIVERY" || delivery === "RETIRO" ? delivery : undefined,
    paymentStatus: payment === "PENDIENTE" || payment === "PAGADO" ? payment : undefined,
    q: q || undefined,
    page: Number.isInteger(page) && page > 0 ? page : undefined,
  };
}

/** Parámetros de la URL para un conjunto de filtros (para los enlaces de paginación). */
export function orderFiltersToQuery(filters: OrderFilters, page?: number): string {
  const query = new URLSearchParams();
  if (filters.date) query.set("fecha", filters.date);
  if (filters.status) query.set("estado", filters.status);
  if (filters.deliveryType) query.set("entrega", filters.deliveryType);
  if (filters.paymentStatus) query.set("pago", filters.paymentStatus);
  if (filters.q) query.set("q", filters.q);
  if (page && page > 1) query.set("pagina", String(page));
  const text = query.toString();
  return text ? `?${text}` : "";
}
