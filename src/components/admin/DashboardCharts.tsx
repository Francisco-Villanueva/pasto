import type { Cents } from "@/domain/money";
import { formatMoney } from "@/domain/money";
import type { OrderStatus } from "@/domain/orders";
import { formatShortDate } from "@/domain/schedule";
import { StatusDot, orderStatusLabel } from "@/components/ui";

/** Etapas que se ven en el gráfico: lo que todavía está en marcha. Entregados y cancelados no. */
const PIPELINE: { status: OrderStatus; tone: "hollow" | "terracota" | "verde" | "cobre" }[] = [
  { status: "PRELIMINAR", tone: "hollow" },
  { status: "PENDIENTE_CONFIRMACION", tone: "terracota" },
  { status: "CONFIRMADO", tone: "verde" },
  { status: "EN_PRODUCCION", tone: "cobre" },
  { status: "LISTO", tone: "verde" },
];

/** Barras horizontales, una por etapa del pedido. El número va siempre escrito. */
export function StatusPipeline({ byStatus }: { byStatus: Record<OrderStatus, number> }) {
  const max = Math.max(1, ...PIPELINE.map((s) => byStatus[s.status]));
  const total = PIPELINE.reduce((sum, s) => sum + byStatus[s.status], 0);
  if (total === 0) return <p className="muted">No hay pedidos en curso.</p>;
  return (
    <ul className="pasto-hbars">
      {PIPELINE.map(({ status, tone }) => {
        const value = byStatus[status];
        return (
          <li key={status} className={value === 0 ? "is-empty" : undefined}>
            <span className="pasto-hbars__label">
              <StatusDot tone={tone} />
              {orderStatusLabel(status)}
            </span>
            <span className="pasto-hbars__track" aria-hidden="true">
              <i className={`pasto-bar--${tone}`} style={{ width: `${(value / max) * 100}%` }} />
            </span>
            <span className="pasto-hbars__value num">{value}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Columnas con la cantidad de pedidos de cada próxima fecha de entrega. */
export function UpcomingDeliveries({
  days,
  showMoney,
}: {
  days: { date: string; orders: number; revenueCents: Cents }[];
  showMoney: boolean;
}) {
  if (days.length === 0) return <p className="muted">No hay entregas programadas.</p>;
  const max = Math.max(1, ...days.map((d) => d.orders));
  return (
    <ol className="pasto-cols">
      {days.map((day) => (
        <li key={day.date}>
          <span className="pasto-cols__value num">{day.orders}</span>
          <span className="pasto-cols__track" aria-hidden="true">
            <i style={{ height: `${Math.max(6, (day.orders / max) * 100)}%` }} />
          </span>
          <span className="pasto-cols__label">{formatShortDate(day.date)}</span>
          {showMoney && (
            <span className="pasto-cols__money caption">{formatMoney(day.revenueCents)}</span>
          )}
          <span className="sr-only">{day.orders === 1 ? "1 pedido" : `${day.orders} pedidos`}</span>
        </li>
      ))}
    </ol>
  );
}

/** Anillo de cobros: cuántos pedidos de una fecha ya están pagados. */
export function PaymentRing({ paid, total }: { paid: number; total: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const share = total > 0 ? paid / total : 0;
  return (
    <div className="pasto-ring">
      <svg viewBox="0 0 100 100" role="img" aria-label={`${paid} de ${total} pedidos pagados`}>
        <circle cx="50" cy="50" r={radius} className="pasto-ring__track" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          className="pasto-ring__value"
          strokeDasharray={`${share * circumference} ${circumference}`}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <span className="pasto-ring__text num">
        {paid}/{total}
      </span>
    </div>
  );
}
