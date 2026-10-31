import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  HeartHandshake,
  MessageCircleQuestion,
  Phone,
  SkipForward,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { CrmTaskActions } from "@/components/admin/CrmTaskActions";
import { EmptyState, Icon, PageHead, cx } from "@/components/ui";
import { getDb } from "@/db";
import { formatDateTime, formatShortDate, localDate as localToday } from "@/domain/schedule";
import { buildWhatsappUrl } from "@/domain/whatsapp";
import { buildFollowUpMessage } from "@/domain/survey";
import { requireStaff } from "@/server/auth/dal";
import { countCrmTasks, listCrmTasks, type CrmTaskRow, type CrmView } from "@/server/crm";

export const metadata: Metadata = { title: "Seguimiento" };

const VIEWS: { value: CrmView; slug: string; label: string }[] = [
  { value: "HOY", slug: "hoy", label: "Para hoy" },
  { value: "PROXIMAS", slug: "proximas", label: "Próximas" },
  { value: "HECHAS", slug: "hechas", label: "Hechas" },
];

const TYPE: Record<CrmTaskRow["type"], { label: string; icon: LucideIcon }> = {
  D5_CHECKIN: { label: "Consulta a los 5 días", icon: MessageCircleQuestion },
  D12_SURVEY: { label: "Encuesta a los 12 días", icon: ClipboardList },
};

function daysLate(date: string, today: string) {
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff("CRM_VIEW");
  const { vista } = await searchParams;
  const current = VIEWS.find((v) => v.slug === vista) ?? VIEWS[0]!;
  const now = new Date();
  const today = localToday(now);
  const db = await getDb();
  const [tasks, counts] = await Promise.all([
    listCrmTasks(db, now, current.value),
    countCrmTasks(db, now),
  ]);
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const countFor = { HOY: counts.today, PROXIMAS: counts.upcoming, HECHAS: undefined };

  function TaskCard({ task }: { task: CrmTaskRow }) {
    const type = TYPE[task.type];
    const pending = task.status === "PENDIENTE";
    const late = pending && task.scheduledFor < today ? daysLate(task.scheduledFor, today) : 0;
    const whatsappUrl = buildWhatsappUrl(
      task.customerPhone,
      buildFollowUpMessage(task.type, {
        customerName: task.customerName,
        surveyUrl: `${appUrl}/evaluacion/${task.surveyToken}`,
      }),
    );
    return (
      <li className={cx("pasto-follow", late > 0 && "is-late")}>
        <span className="pasto-avatar pasto-follow__avatar" aria-hidden="true">
          {task.customerName.trim().charAt(0).toUpperCase()}
        </span>
        <div className="pasto-follow__who">
          <b>{task.customerName}</b>
          <span className="caption muted pasto-iconline">
            <Icon icon={Phone} size={14} />
            <span className="num">{task.customerPhone}</span> · {task.orderNumber}
          </span>
        </div>
        <div className="pasto-follow__what">
          <span className="pasto-iconline">
            <Icon icon={type.icon} size={16} />
            {type.label}
          </span>
          <span className="caption muted pasto-iconline">
            <Icon icon={CalendarClock} size={14} />
            {formatShortDate(task.scheduledFor)}
          </span>
          {late > 0 && (
            <span className="pasto-flagtag">
              <Icon icon={TriangleAlert} size={12} />
              {late === 1 ? "Atrasada 1 día" : `Atrasada ${late} días`}
            </span>
          )}
        </div>
        <div className="pasto-follow__act">
          {pending ? (
            <CrmTaskActions taskId={task.id} whatsappUrl={whatsappUrl} />
          ) : (
            <div className="stack" style={{ gap: "var(--space-1)" }}>
              <span className="pasto-iconline">
                <Icon icon={task.status === "COMPLETADA" ? CheckCircle2 : SkipForward} size={16} />
                <b>{task.status === "COMPLETADA" ? "Completada" : "Omitida"}</b>
                {task.completedAt && (
                  <span className="caption muted">{formatDateTime(task.completedAt)}</span>
                )}
              </span>
              {task.resultNotes && <span className="caption">{task.resultNotes}</span>}
            </div>
          )}
        </div>
      </li>
    );
  }

  const overdue = tasks.filter((t) => t.status === "PENDIENTE" && t.scheduledFor < today);
  const rest = tasks.filter((t) => !overdue.includes(t));

  return (
    <>
      <PageHead label="SEGUIMIENTO" title="Seguimiento">
        Escribile a cada cliente después de la entrega y anotá cómo fue.
      </PageHead>

      <nav className="pasto-chips" aria-label="Vistas">
        {VIEWS.map((view) => {
          const count = countFor[view.value];
          const attention = view.value === "HOY" && (count ?? 0) > 0;
          return (
            <Link
              key={view.slug}
              href={`/admin/crm?vista=${view.slug}`}
              className={cx("pasto-chip", attention && "pasto-chip--attention")}
              aria-current={view === current ? "page" : undefined}
            >
              {view.label}
              {count !== undefined && <span className="pasto-chip__count num">{count}</span>}
            </Link>
          );
        })}
      </nav>

      {tasks.length === 0 ? (
        <EmptyState
          icon={HeartHandshake}
          title={
            current.value === "HOY"
              ? "No hay nadie a quien escribirle hoy"
              : "No hay tareas en esta vista"
          }
        >
          Las tareas se crean solas cuando un pedido se marca como entregado.
        </EmptyState>
      ) : (
        <>
          {overdue.length > 0 && (
            <section className="stack" aria-labelledby="atrasadas">
              <h2 id="atrasadas" className="title pasto-h-icon">
                <Icon icon={TriangleAlert} size={20} /> Atrasadas
                <span className="pasto-chip__count num">{overdue.length}</span>
              </h2>
              <ul className="pasto-followlist">
                {overdue.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </ul>
            </section>
          )}
          {rest.length > 0 && (
            <section className="stack" aria-labelledby="lista">
              {overdue.length > 0 && (
                <h2 id="lista" className="title pasto-h-icon">
                  <Icon icon={CalendarClock} size={20} /> {current.label}
                </h2>
              )}
              <ul className="pasto-followlist">
                {rest.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  );
}
