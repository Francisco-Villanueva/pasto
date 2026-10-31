import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button, Tag } from "@design/react";
import {
  EmptyState,
  OrderStatusBadge,
  PageHead,
  PaymentBadge,
  SelectField,
  Table,
  TextField,
} from "@/components/ui";
import { getDb } from "@/db";
import { formatMoney } from "@/domain/money";
import { ORDER_STATUSES } from "@/domain/orders";
import { formatShortDate } from "@/domain/schedule";
import { orderFiltersToQuery, parseOrderFilters } from "@/lib/order-filters";
import { STATUS_LABEL } from "@/lib/order-labels";
import { listOrderDates, listOrders } from "@/server/admin-orders";
import { requireStaff } from "@/server/auth/dal";

export const metadata: Metadata = { title: "Pedidos" };

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff("ORDERS_VIEW");
  const filters = parseOrderFilters(await searchParams);
  const db = await getDb();
  const [list, dates] = await Promise.all([listOrders(db, filters), listOrderDates(db)]);

  const hasFilters = Boolean(
    filters.date || filters.status || filters.deliveryType || filters.paymentStatus || filters.q,
  );

  return (
    <>
      <div className="row-between">
        <PageHead label="PEDIDOS" title="Pedidos" />
        <Button href="/admin/pedidos/nuevo">Nuevo pedido</Button>
      </div>

      <form method="get" className="stack" aria-label="Filtros">
        <div className="pasto-fields-2">
          <SelectField label="Fecha de entrega" name="fecha" defaultValue={filters.date ?? ""}>
            <option value="">Todas</option>
            {dates.map((date) => (
              <option key={date} value={date}>
                {formatShortDate(date)}
              </option>
            ))}
          </SelectField>
          <SelectField label="Estado" name="estado" defaultValue={filters.status ?? ""}>
            <option value="">Todos</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABEL[status]}
              </option>
            ))}
          </SelectField>
          <SelectField label="Entrega" name="entrega" defaultValue={filters.deliveryType ?? ""}>
            <option value="">Todas</option>
            <option value="DELIVERY">Envío</option>
            <option value="RETIRO">Retiro</option>
          </SelectField>
          <SelectField label="Pago" name="pago" defaultValue={filters.paymentStatus ?? ""}>
            <option value="">Todos</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="PAGADO">Pagado</option>
          </SelectField>
        </div>
        <TextField
          label="Buscar"
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Número de pedido, nombre o teléfono"
          type="search"
        />
        <div className="row">
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
          {hasFilters && (
            <Button href="/admin/pedidos" variant="ghost">
              Limpiar filtros
            </Button>
          )}
          <span className="body-sm muted" role="status">
            {list.total === 1 ? "1 pedido" : `${list.total} pedidos`}
          </span>
        </div>
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
            {list.rows.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link href={`/admin/pedidos/${order.id}`}>
                    <b>{order.orderNumber}</b>
                  </Link>
                  {order.origin === "MANUAL" && (
                    <>
                      {" "}
                      <Tag tone="outline">Manual</Tag>
                    </>
                  )}
                </td>
                <td>
                  {order.customerName}
                  <br />
                  <span className="caption muted">{order.customerPhone}</span>
                </td>
                <td>
                  {formatShortDate(order.scheduledDate)} · {order.scheduledTimeSlot}
                  <br />
                  <span className="caption muted">
                    {order.deliveryType === "DELIVERY" ? "Envío" : "Retiro"}
                    {order.feeToConfirm ? " · envío a confirmar" : ""}
                  </span>
                </td>
                <td>
                  <OrderStatusBadge status={order.status} />
                </td>
                <td>
                  <PaymentBadge status={order.paymentStatus} />
                </td>
                <td className="is-num">{formatMoney(order.totalCents)}</td>
                <td className="is-num">
                  <Button href={`/admin/pedidos/${order.id}`} variant="ghost" small>
                    Abrir
                  </Button>
                </td>
              </tr>
            ))}
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
