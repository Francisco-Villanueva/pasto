import type { Metadata } from "next";
import { ChefHat } from "lucide-react";
import { Button } from "@design/react";
import { KitchenActions } from "@/components/admin/KitchenActions";
import { PrintButton } from "@/components/admin/PrintButton";
import { EmptyState, OrderStatusBadge, PageHead, SelectField, Table } from "@/components/ui";
import { getDb } from "@/db";
import { formatProductionRow } from "@/domain/production";
import { formatShortDate } from "@/domain/schedule";
import { requireStaff } from "@/server/auth/dal";
import { listProductionDates, loadProductionSheet } from "@/server/production";

export const metadata: Metadata = { title: "Producción" };

export default async function ProduccionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff("PRODUCTION_VIEW");
  const db = await getDb();
  const dates = await listProductionDates(db, new Date());
  const { fecha } = await searchParams;
  const requested = typeof fecha === "string" ? fecha : undefined;
  const date = requested && dates.includes(requested) ? requested : dates[0];

  if (!date) {
    return (
      <>
        <PageHead label="PRODUCCIÓN" title="Producción" />
        <EmptyState icon={ChefHat} title="Todavía no hay nada para cocinar">
          Los pedidos aparecen acá cuando se confirman.
        </EmptyState>
      </>
    );
  }

  const sheet = await loadProductionSheet(db, date);
  const toCook = sheet.orders.filter((o) => o.status !== "LISTO").length;

  return (
    <>
      <PageHead label="PRODUCCIÓN" title="Producción">
        {formatShortDate(date)} · {toCook} {toCook === 1 ? "pedido" : "pedidos"} por cocinar
      </PageHead>

      <form method="get" className="row no-print" aria-label="Elegir fecha">
        <SelectField label="Fecha de entrega" name="fecha" defaultValue={date}>
          {dates.map((d) => (
            <option key={d} value={d}>
              {formatShortDate(d)}
            </option>
          ))}
        </SelectField>
        <Button type="submit" variant="secondary">
          Ver
        </Button>
        <Button href={`/api/admin/production?fecha=${date}`} variant="secondary">
          Descargar CSV
        </Button>
        <PrintButton />
      </form>

      <section className="stack" aria-labelledby="total-recetas">
        <h2 id="total-recetas" className="heading">
          Total por receta
        </h2>
        {sheet.rows.length === 0 ? (
          <p className="muted">No queda nada por cocinar para esta fecha.</p>
        ) : (
          <Table label="Total por receta">
            <thead>
              <tr>
                <th scope="col">Receta</th>
                <th scope="col" className="is-num">
                  Unidades
                </th>
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row) => (
                <tr key={row.productId}>
                  <td>{row.productName}</td>
                  <td className="is-num">
                    <span aria-label={formatProductionRow(row)}>{row.units}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </section>

      <section className="stack" aria-labelledby="pedidos-dia">
        <h2 id="pedidos-dia" className="heading">
          Pedidos del día
        </h2>
        <Table label="Pedidos del día">
          <thead>
            <tr>
              <th scope="col">Pedido</th>
              <th scope="col">Franja</th>
              <th scope="col">Contenido</th>
              <th scope="col">Estado</th>
              <th scope="col" className="no-print">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sheet.orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <b>{order.orderNumber}</b>
                </td>
                <td>
                  {order.timeSlot}
                  <br />
                  <span className="caption muted">
                    {order.deliveryType === "DELIVERY" ? "Envío" : "Retiro"}
                  </span>
                </td>
                <td>
                  {order.items.map((item, i) => (
                    <div key={i}>
                      <b>{item.label}</b>:{" "}
                      {item.dishes.map((d) => `${d.quantity}x ${d.name}`).join(", ")}
                    </div>
                  ))}
                </td>
                <td>
                  <OrderStatusBadge status={order.status} />
                </td>
                <td className="no-print">
                  <KitchenActions orderId={order.id} status={order.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
    </>
  );
}
