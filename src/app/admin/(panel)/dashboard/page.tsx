import {
  BadgeDollarSign,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  HeartHandshake,
  Hourglass,
  PackageCheck,
  ReceiptText,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  PaymentRing,
  StatusPipeline,
  UpcomingDeliveries,
} from "@/components/admin/DashboardCharts";
import { Icon, PageHead } from "@/components/ui";
import { getDb } from "@/db";
import { formatMoney } from "@/domain/money";
import { can } from "@/domain/permissions";
import { formatShortDate } from "@/domain/schedule";
import { requireStaff } from "@/server/auth/dal";
import { loadDashboard, type Dashboard } from "@/server/dashboard";

export const metadata: Metadata = { title: "Panel" };

type Task = {
  key: string;
  icon: LucideIcon;
  count: number;
  title: string;
  hint: string;
  /** Qué se muestra cuando no hay nada pendiente. */
  clear: string;
  href: string;
  /** "now": lo resuelve PASTO ahora. "waiting": depende del cliente. */
  kind: "now" | "waiting";
};

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

function tasksFor(data: Dashboard): Task[] {
  return [
    {
      key: "confirmar",
      clear: "Nada por confirmar",
      icon: ReceiptText,
      count: data.toConfirm,
      title: plural(data.toConfirm, "Pedido por confirmar", "Pedidos por confirmar"),
      hint: "El cliente ya escribió por WhatsApp. Revisá y confirmá.",
      href: "/admin/pedidos?estado=PENDIENTE_CONFIRMACION",
      kind: "now",
    },
    {
      key: "envios",
      clear: "Ningún envío a cotizar",
      icon: Truck,
      count: data.feeToConfirm,
      title: plural(data.feeToConfirm, "Envío a cotizar", "Envíos a cotizar"),
      hint: "Falta definir el costo de envío para poder avanzar.",
      href: "/admin/pedidos",
      kind: "now",
    },
    {
      key: "cobros",
      clear: "Cobros al día",
      icon: Wallet,
      count: data.next?.unpaid ?? 0,
      title: plural(data.next?.unpaid ?? 0, "Cobro pendiente", "Cobros pendientes"),
      hint: data.next
        ? `Pedidos de la próxima entrega (${formatShortDate(data.next.date)}) sin pagar.`
        : "Pedidos de la próxima entrega sin pagar.",
      href: data.next ? `/admin/pedidos?fecha=${data.next.date}` : "/admin/pedidos",
      kind: "now",
    },
    {
      key: "seguimiento",
      clear: "Seguimientos al día",
      icon: HeartHandshake,
      count: data.followUpsDue,
      title: plural(data.followUpsDue, "Seguimiento para hacer", "Seguimientos para hacer"),
      hint: "Clientes a quienes escribirles hoy para saber cómo les fue.",
      href: "/admin/crm",
      kind: "now",
    },
    {
      key: "preliminares",
      clear: "Ningún pedido sin enviar",
      icon: Hourglass,
      count: data.preliminary,
      title: plural(data.preliminary, "Pedido sin enviar", "Pedidos sin enviar"),
      hint: "Armados en la web, todavía sin mensaje de WhatsApp. Esperan al cliente.",
      href: "/admin/pedidos?estado=PRELIMINAR",
      kind: "waiting",
    },
  ];
}

export default async function DashboardPage() {
  const user = await requireStaff("DASHBOARD_VIEW");
  // Los importes solo los ve quien tiene permiso; si no, ni siquiera se consultan.
  const data = can(user.role, "FINANCIALS_VIEW")
    ? await loadDashboard(await getDb(), new Date())
    : null;

  const tasks = data ? tasksFor(data) : [];
  const pending = tasks.filter((t) => t.count > 0);
  const urgent = pending.filter((t) => t.kind === "now");
  const waiting = pending.filter((t) => t.kind === "waiting");

  return (
    <>
      <PageHead label="PANEL" title="Hola">
        {user.fullName ?? user.email}.
      </PageHead>

      {data && (
        <>
          <section className="pasto-dash" aria-labelledby="atender">
            <div className="pasto-todo">
              <header className="pasto-todo__head">
                <h2 id="atender" className="heading">
                  Para atender ahora
                </h2>
                <span className={urgent.length > 0 ? "pasto-flag pasto-flag--now" : "pasto-flag"}>
                  <Icon icon={urgent.length > 0 ? PackageCheck : CheckCircle2} size={16} />
                  {urgent.length > 0
                    ? `${urgent.length} ${plural(urgent.length, "tema", "temas")} para resolver`
                    : "Todo al día"}
                </span>
              </header>

              {pending.length === 0 ? (
                <div className="pasto-todo__clear">
                  <Icon icon={CheckCircle2} size={28} />
                  <p>
                    No hay nada esperando. Cuando entre un pedido nuevo, lo vas a ver acá primero.
                  </p>
                </div>
              ) : (
                <ul className="pasto-todo__list">
                  {[...urgent, ...waiting].map((task) => (
                    <li key={task.key}>
                      <Link
                        href={task.href}
                        className={
                          task.kind === "now" ? "pasto-task pasto-task--now" : "pasto-task"
                        }
                      >
                        <span className="pasto-task__icon">
                          <Icon icon={task.icon} size={22} />
                        </span>
                        <span className="pasto-task__count num">{task.count}</span>
                        <span className="pasto-task__body">
                          <span className="pasto-task__title">{task.title}</span>
                          <span className="pasto-task__hint">{task.hint}</span>
                        </span>
                        <span className="pasto-task__go">
                          {task.kind === "now" ? "Resolver" : "Ver"}
                          <Icon icon={ChevronRight} size={18} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {pending.length > 0 && (
                <ul className="pasto-todo__done" aria-label="Sin pendientes">
                  {tasks
                    .filter((t) => t.count === 0)
                    .map((t) => (
                      <li key={t.key}>
                        <Icon icon={CheckCircle2} size={16} />
                        {t.clear}
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <aside className="pasto-next" aria-labelledby="proxima">
              <h2 id="proxima" className="title pasto-next__title">
                <Icon icon={CalendarCheck} size={20} />
                Próxima entrega
              </h2>
              {data.next ? (
                <>
                  <p className="pasto-next__date">{formatShortDate(data.next.date)}</p>
                  <dl className="pasto-next__facts">
                    <div>
                      <dt>
                        <Icon icon={ReceiptText} size={16} />
                        Pedidos
                      </dt>
                      <dd className="num">{data.next.orders}</dd>
                    </div>
                    <div>
                      <dt>
                        <Icon icon={BadgeDollarSign} size={16} />
                        Confirmado
                      </dt>
                      <dd className="num">{formatMoney(data.next.revenueCents)}</dd>
                    </div>
                  </dl>
                  <div className="pasto-next__pay">
                    <PaymentRing
                      paid={Math.max(0, data.next.orders - data.next.unpaid)}
                      total={data.next.orders}
                    />
                    <span className="body-sm">
                      {data.next.unpaid === 0
                        ? "Todo cobrado"
                        : `${data.next.unpaid} ${plural(data.next.unpaid, "pedido", "pedidos")} sin pagar`}
                    </span>
                  </div>
                  <Link
                    href={`/admin/pedidos?fecha=${data.next.date}`}
                    className="pasto-next__link"
                  >
                    Ver pedidos de esta fecha
                    <Icon icon={ChevronRight} size={18} />
                  </Link>
                </>
              ) : (
                <p className="muted">No hay pedidos para las próximas fechas.</p>
              )}
            </aside>
          </section>

          <section className="pasto-charts" aria-label="Estado de la operación">
            <article className="pasto-chart">
              <h2 className="title">Pedidos en curso</h2>
              <p className="body-sm muted">Dónde está parado cada pedido ahora.</p>
              <StatusPipeline byStatus={data.byStatus} />
            </article>
            <article className="pasto-chart">
              <h2 className="title">Próximas entregas</h2>
              <p className="body-sm muted">Pedidos por fecha, sin contar cancelados.</p>
              <UpcomingDeliveries days={data.upcoming} showMoney />
            </article>
          </section>
        </>
      )}
    </>
  );
}
