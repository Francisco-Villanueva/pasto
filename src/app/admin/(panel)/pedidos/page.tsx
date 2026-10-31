import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Clock,
  Eraser,
  Plus,
  Search,
  SearchX,
  SlidersHorizontal,
  Store,
  Truck,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@design/react";
import {
  EmptyState,
  Icon,
  OrderStatusBadge,
  PageHead,
  PaymentBadge,
  Table,
  cx,
} from "@/components/ui";
import { getDb } from "@/db";
import { formatMoney } from "@/domain/money";
import { ORDER_STATUSES, type OrderStatus } from "@/domain/orders";
import { formatShortDate } from "@/domain/schedule";
import { orderFiltersToQuery, parseOrderFilters } from "@/lib/order-filters";
import { STATUS_LABEL } from "@/lib/order-labels";
import { countOrdersByStatus, listOrderDates, listOrders } from "@/server/admin-orders";
import { requireStaff } from "@/server/auth/dal";

export const metadata: Metadata = { title: "Pedidos" };

/** Orden de los filtros rápidos: primero lo que espera una decisión, al final lo cerrado. */
const QUICK_STATUSES: OrderStatus[] = [
  "PENDIENTE_CONFIRMACION",
  "CONFIRMADO",
  "EN_PRODUCCION",
  "LISTO",
  "PRELIMINAR",
  "ENTREGADO",
  "CANCELADO",
];

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff("ORDERS_VIEW");
  const filters = parseOrderFilters(await searchParams);
  const db = await getDb();
  const [list, dates, counts] = await Promise.all([
    listOrders(db, filters),
    listOrderDates(db),
    countOrdersByStatus(db),
  ]);
  const totalAll = ORDER_STATUSES.reduce((sum, s) => sum + counts[s], 0);

  const hasFilters = Boolean(
    filters.date || filters.status || filters.deliveryType || filters.paymentStatus || filters.q,
  );
  const hrefFor = (status?: OrderStatus) =>
    `/admin/pedidos${orderFiltersToQuery({ ...filters, status, page: undefined })}`;

  return (
    <>
      <div className="row-between">
        <PageHead label="PEDIDOS" title="Pedidos" />
        <Button href="/admin/pedidos/nuevo">
          <Icon icon={Plus} /> Nuevo pedido
        </Button>
      </div>

      <nav className="pasto-chips" aria-label="Filtrar por estado">
        <Link
          href={hrefFor(undefined)}
          className="pasto-chip"
          aria-current={filters.status ? undefined : "page"}
        >
          Todos <span className="pasto-chip__count num">{totalAll}</span>
        </Link>
        {QUICK_STATUSES.map((status) => {
          const attention = status === "PENDIENTE_CONFIRMACION" && counts[status] > 0;
          return (
            <Link
              key={status}
              href={hrefFor(status)}
              className={cx("pasto-chip", attention && "pasto-chip--attention")}
              aria-current={filters.status === status ? "page" : undefined}
            >
              {attention && <Icon icon={TriangleAlert} size={14} />}
              {STATUS_LABEL[status]}
              <span className="pasto-chip__count num">{counts[status]}</span>
            </Link>
          );
        })}
      </nav>

      <form method="get" className="pasto-filterbar" aria-label="Buscar y filtrar">
        {filters.status && <input type="hidden" name="estado" value={filters.status} />}
        <label className="pasto-search">
          <Icon icon={Search} />
          <span className="sr-only">Buscar</span>
          <input
            className="pasto-input"
            type="search"
            name="q"
            defaultValue={filters.q ?? ""}
            placeholder="Número de pedido, nombre o teléfono"
          />
        </label>
        <label className="pasto-filterbar__select">
          <span className="sr-only">Fecha de entrega</span>
          <select className="pasto-select" name="fecha" defaultValue={filters.date ?? ""}>
            <option value="">Todas las fechas</option>
            {dates.map((date) => (
              <option key={date} value={date}>
                {formatShortDate(date)}
              </option>
            ))}
          </select>
        </label>
        <label className="pasto-filterbar__select">
          <span className="sr-only">Tipo de entrega</span>
          <select className="pasto-select" name="entrega" defaultValue={filters.deliveryType ?? ""}>
            <option value="">Envío y retiro</option>
            <option value="DELIVERY">Envío</option>
            <option value="RETIRO">Retiro</option>
          </select>
        </label>
        <label className="pasto-filterbar__select">
          <span className="sr-only">Pago</span>
          <select className="pasto-select" name="pago" defaultValue={filters.paymentStatus ?? ""}>
            <option value="">Todos los pagos</option>
            <option value="PENDIENTE">Pago pendiente</option>
            <option value="PAGADO">Pagado</option>
          </select>
        </label>
        <Button type="submit" variant="secondary">
          <Icon icon={SlidersHorizontal} /> Filtrar
        </Button>
        {hasFilters && (
          <Button href="/admin/pedidos" variant="ghost">
            <Icon icon={Eraser} /> Limpiar
          </Button>
        )}
        <span className="body-sm muted pasto-filterbar__count" role="status">
          {list.total === 1 ? "1 pedido" : `${list.total} pedidos`}
        </span>
      </form>

      {list.rows.length === 0 ? (
        <EmptyState icon={SearchX} title="No hay pedidos con estos filtros">
          Probá con otra fecha o quitá algún filtro.
        </EmptyState>
      ) : (
        <Table label="Pedidos">
          <thead>
            <tr>
              <th scope="col">Pedido</th>
              <th scope="col">Cliente</th>
              <th scope="col">Entrega</th>
              <th scope="col">Estado</th>
              <th scope="col">Pago</th>
              <th scope="col" className="is-num">
                Total
              </th>
              <th scope="col">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.rows.map((order) => {
              const toDecide = order.status === "PENDIENTE_CONFIRMACION";
              return (
                <tr key={order.id} className={toDecide ? "is-attention" : undefined}>
                  <td>
                    <Link href={`/admin/pedidos/${order.id}`} className="pasto-ordernum">
                      {order.orderNumber}
                    </Link>
                    {order.origin === "MANUAL" && (
                      <span className="caption muted pasto-block">Cargado a mano</span>
                    )}
                  </td>
                  <td>
                    <b>{order.customerName}</b>
                    <span className="caption muted pasto-block num">{order.customerPhone}</span>
                  </td>
                  <td>
                    <span className="pasto-iconline">
                      <Icon icon={Clock} size={14} />
                      {formatShortDate(order.scheduledDate)} · {order.scheduledTimeSlot}
                    </span>
                    <span className="pasto-iconline caption muted">
                      <Icon icon={order.deliveryType === "DELIVERY" ? Truck : Store} size={14} />
                      {order.deliveryType === "DELIVERY" ? "Envío" : "Retiro"}
                    </span>
                    {order.feeToConfirm && (
                      <span className="pasto-flagtag">
                        <Icon icon={TriangleAlert} size={12} /> Cotizar envío
                      </span>
                    )}
                  </td>
                  <td>
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td>
                    <PaymentBadge status={order.paymentStatus} />
                  </td>
                  <td className="is-num">
                    <b>{formatMoney(order.totalCents)}</b>
                  </td>
                  <td className="is-num">
                    <Button
                      href={`/admin/pedidos/${order.id}`}
                      variant={toDecide ? "secondary" : "ghost"}
                      small
                    >
                      {toDecide ? "Revisar" : "Abrir"} <Icon icon={ArrowRight} size={16} />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      {list.pageCount > 1 && (
        <nav className="row-between" aria-label="Paginación">
          {list.page > 1 ? (
            <Button
              href={`/admin/pedidos${orderFiltersToQuery(filters, list.page - 1)}`}
              variant="secondary"
              small
            >
              Anterior
            </Button>
          ) : (
            <span />
          )}
          <span className="body-sm muted num">
            Página {list.page} de {list.pageCount}
          </span>
          {list.page < list.pageCount ? (
            <Button
              href={`/admin/pedidos${orderFiltersToQuery(filters, list.page + 1)}`}
              variant="secondary"
              small
            >
              Siguiente
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </>
  );
}
