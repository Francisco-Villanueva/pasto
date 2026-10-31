import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  ChefHat,
  Clock,
  Download,
  Flame,
  PackageCheck,
  Store,
  Truck,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@design/react";
import { KitchenActions } from "@/components/admin/KitchenActions";
import { PrintButton } from "@/components/admin/PrintButton";
import { EmptyState, Icon, PageHead, Progress } from "@/components/ui";
import { getDb } from "@/db";
import { formatProductionRow } from "@/domain/production";
import type { OrderStatus } from "@/domain/orders";
import { formatShortDate } from "@/domain/schedule";
import { requireStaff } from "@/server/auth/dal";
import { listProductionDates, loadProductionSheet } from "@/server/production";

export const metadata: Metadata = { title: "Producción" };

/** Las tres etapas de la cocina, en el orden en que avanza un pedido. */
const STAGES: {
  status: OrderStatus;
  title: string;
  empty: string;
  icon: LucideIcon;
}[] = [
  { status: "CONFIRMADO", title: "Por empezar", empty: "No hay pedidos esperando.", icon: Clock },
  { status: "EN_PRODUCCION", title: "Cocinando", empty: "Nada en la cocina ahora.", icon: Flame },
  { status: "LISTO", title: "Listos", empty: "Todavía no hay pedidos listos.", icon: PackageCheck },
];

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
  const byStage = STAGES.map((stage) => ({
    ...stage,
    orders: sheet.orders
      .filter((o) => o.status === stage.status)
      .sort(
        (a, b) =>
          a.timeSlot.localeCompare(b.timeSlot) || a.orderNumber.localeCompare(b.orderNumber),
      ),
  }));
  const ready = byStage[2]!.orders.length;
  const total = sheet.orders.length;
  const toCook = total - ready;
  const maxUnits = Math.max(1, ...sheet.rows.map((r) => r.units));

  return (
    <>
      <div className="row-between">
        <PageHead label="PRODUCCIÓN" title="Producción">
          {formatShortDate(date)} · {toCook} {toCook === 1 ? "pedido" : "pedidos"} por cocinar
        </PageHead>
        <div className="row no-print">
          <Button href={`/api/admin/production?fecha=${date}`} variant="secondary">
            <Icon icon={Download} /> Descargar CSV
          </Button>
          <PrintButton />
        </div>
      </div>

      <nav className="pasto-chips no-print" aria-label="Fecha de entrega">
        <Icon icon={CalendarDays} />
        {dates.map((d) => (
          <Link
            key={d}
            href={`/admin/produccion?fecha=${d}`}
            className="pasto-chip pasto-chip--date"
            aria-current={d === date ? "page" : undefined}
          >
            {formatShortDate(d)}
          </Link>
        ))}
      </nav>

      <section className="pasto-kitchen-progress" aria-label="Avance de la cocina">
        <div className="pasto-kitchen-progress__text">
          <span className="pasto-kitchen-progress__num num">
            {ready}
            <span className="muted"> de {total}</span>
          </span>
          <span className="body-sm muted">
            {total === 0
              ? "No hay pedidos para esta fecha."
              : ready === total
                ? "Todo listo para entregar."
                : "pedidos listos para entregar"}
          </span>
        </div>
        <Progress value={ready} max={Math.max(total, 1)} label="Pedidos listos" />
      </section>

      <section className="stack" aria-labelledby="total-recetas">
        <h2 id="total-recetas" className="heading pasto-h-icon">
          <Icon icon={UtensilsCrossed} size={22} /> Qué cocinar
        </h2>
        {sheet.rows.length === 0 ? (
          <p className="muted">No queda nada por cocinar para esta fecha.</p>
        ) : (
          <ul className="pasto-recipes">
            {sheet.rows.map((row) => (
              <li key={row.productId}>
                <span className="pasto-recipes__units num" aria-label={formatProductionRow(row)}>
                  {row.units}
                </span>
                <span className="pasto-recipes__name">{row.productName}</span>
                <span className="pasto-recipes__bar" aria-hidden="true">
                  <i style={{ width: `${(row.units / maxUnits) * 100}%` }} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="stack" aria-labelledby="pedidos-dia">
        <h2 id="pedidos-dia" className="heading pasto-h-icon">
          <Icon icon={ChefHat} size={22} /> Pedidos del día
        </h2>
        <div className="pasto-board">
          {byStage.map((stage) => (
            <div key={stage.status} className="pasto-board__col">
              <h3 className="pasto-board__title">
                <Icon icon={stage.icon} size={18} />
                {stage.title}
                <span className="pasto-chip__count num">{stage.orders.length}</span>
              </h3>
              {stage.orders.length === 0 ? (
                <p className="body-sm muted pasto-board__empty">{stage.empty}</p>
              ) : (
                <ul className="pasto-board__list">
                  {stage.orders.map((order) => (
                    <li key={order.id} className="pasto-kcard">
                      <div className="pasto-kcard__head">
                        <b>{order.orderNumber}</b>
                        <span className="pasto-kcard__meta caption">
                          <Icon icon={Clock} size={14} /> {order.timeSlot}
                          <Icon
                            icon={order.deliveryType === "DELIVERY" ? Truck : Store}
                            size={14}
                          />
                          {order.deliveryType === "DELIVERY" ? "Envío" : "Retiro"}
                        </span>
                      </div>
                      <ul className="pasto-kcard__items">
                        {order.items.map((item, i) => (
                          <li key={i}>
                            <b>{item.label}</b>
                            <span className="muted">
                              {item.dishes.map((d) => `${d.quantity}x ${d.name}`).join(", ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="no-print">
                        <KitchenActions orderId={order.id} status={order.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
