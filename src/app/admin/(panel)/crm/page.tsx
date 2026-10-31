import type { Metadata } from "next";
import { HeartHandshake } from "lucide-react";
import { Button, Tag } from "@design/react";
import { CrmTaskActions } from "@/components/admin/CrmTaskActions";
import { EmptyState, PageHead, Table } from "@/components/ui";
import { getDb } from "@/db";
import { formatDateTime, formatShortDate, localDate as localToday } from "@/domain/schedule";
import { buildWhatsappUrl } from "@/domain/whatsapp";
import { buildFollowUpMessage } from "@/domain/survey";
import { requireStaff } from "@/server/auth/dal";
import { listCrmTasks, type CrmView } from "@/server/crm";

export const metadata: Metadata = { title: "Seguimiento" };

const VIEWS: { value: CrmView; slug: string; label: string }[] = [
  { value: "HOY", slug: "hoy", label: "Para hoy" },
  { value: "PROXIMAS", slug: "proximas", label: "Próximas" },
  { value: "HECHAS", slug: "hechas", label: "Hechas" },
];

const TYPE_LABEL = { D5_CHECKIN: "Consulta a los 5 días", D12_SURVEY: "Encuesta a los 12 días" };

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff("CRM_VIEW");
  const { vista } = await searchParams;
  const current = VIEWS.find((v) => v.slug === vista) ?? VIEWS[0]!;
  const now = new Date();
  const tasks = await listCrmTasks(await getDb(), now, current.value);
  const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

  return (
    <>
      <PageHead label="SEGUIMIENTO" title="Seguimiento">
        Escribile a cada cliente después de la entrega y anotá cómo fue.
      </PageHead>

      <nav className="row" aria-label="Vistas">
        {VIEWS.map((view) => (
          <Button
            key={view.slug}
            href={`/admin/crm?vista=${view.slug}`}
            variant={view === current ? "primary" : "secondary"}
            small
            aria-current={view === current ? "page" : undefined}
          >
            {view.label}
          </Button>
        ))}
      </nav>

      {tasks.length === 0 ? (
        <EmptyState icon={HeartHandshake} title="No hay tareas en esta vista">
          Las tareas se crean solas cuando un pedido se marca como entregado.
        </EmptyState>
      ) : (
        <Table label="Tareas de seguimiento">
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col">Tarea</th>
              <th scope="col">Para</th>
              <th scope="col">
                {current.value === "HECHAS" ? (
                  "Resultado"
                ) : (
                  <span className="sr-only">Acciones</span>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const whatsappUrl = buildWhatsappUrl(
                task.customerPhone,
                buildFollowUpMessage(task.type, {
                  customerName: task.customerName,
                  surveyUrl: `${appUrl}/evaluacion/${task.surveyToken}`,
                }),
              );
              return (
                <tr key={task.id}>
                  <td>
                    {task.customerName}
                    <br />
                    <span className="caption muted">
                      {task.orderNumber} · {task.customerPhone}
                    </span>
                  </td>
                  <td>{TYPE_LABEL[task.type]}</td>
                  <td>
                    {formatShortDate(task.scheduledFor)}
                    {task.status === "PENDIENTE" && task.scheduledFor < localToday(now) && (
                      <>
                        {" "}
                        <Tag tone="outline">Atrasada</Tag>
                      </>
                    )}
                  </td>
                  <td>
                    {task.status === "PENDIENTE" ? (
                      <CrmTaskActions taskId={task.id} whatsappUrl={whatsappUrl} />
                    ) : (
                      <>
                        <Tag tone={task.status === "COMPLETADA" ? "brand" : "outline"}>
                          {task.status === "COMPLETADA" ? "Completada" : "Omitida"}
                        </Tag>
                        {task.completedAt && (
                          <span className="caption muted"> {formatDateTime(task.completedAt)}</span>
                        )}
                        {task.resultNotes && <div className="caption">{task.resultNotes}</div>}
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </>
  );
}
