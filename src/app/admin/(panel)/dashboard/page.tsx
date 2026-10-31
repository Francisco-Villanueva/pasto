import type { Metadata } from "next";
import Link from "next/link";
import { PageHead, Stat } from "@/components/ui";
import { getDb } from "@/db";
import { formatMoney } from "@/domain/money";
import { can, sectionsFor } from "@/domain/permissions";
import { formatShortDate } from "@/domain/schedule";
import { requireStaff } from "@/server/auth/dal";
import { loadDashboard } from "@/server/dashboard";

export const metadata: Metadata = { title: "Panel" };

export default async function DashboardPage() {
  const user = await requireStaff("DASHBOARD_VIEW");
  const sections = sectionsFor(user.role).filter((s) => s.slug !== "dashboard");
  // Los importes solo los ve quien tiene permiso; si no, ni siquiera se consultan.
  const data = can(user.role, "FINANCIALS_VIEW")
    ? await loadDashboard(await getDb(), new Date())
    : null;

  return (
    <>
      <PageHead label="PANEL" title="Hola">
        {user.fullName ?? user.email}.
      </PageHead>

      {data && (
        <section className="stack" aria-labelledby="resumen">
          <h2 id="resumen" className="heading">
            Para atender
          </h2>
          <div className="grid grid-3">
            <Link href="/admin/pedidos?estado=PENDIENTE_CONFIRMACION" className="pasto-panel">
              <Stat
                label="Por confirmar"
                value={String(data.toConfirm)}
                note={
                  data.toConfirm === 1 ? "pedido espera tu decisión" : "pedidos esperan tu decisión"
                }
              />
            </Link>
            <Link href="/admin/pedidos?estado=PRELIMINAR" className="pasto-panel">
              <Stat
                label="Preliminares"
                value={String(data.preliminary)}
                note="sin mensaje de WhatsApp todavía"
              />
            </Link>
            <Link href="/admin/pedidos" className="pasto-panel">
              <Stat
                label="Envíos a cotizar"
                value={String(data.feeToConfirm)}
                note="costo a definir"
              />
            </Link>
          </div>

          <h2 className="heading">Próxima entrega</h2>
          {data.next ? (
            <div className="grid grid-3">
              <Link href={`/admin/pedidos?fecha=${data.next.date}`} className="pasto-panel">
                <Stat
                  label={formatShortDate(data.next.date).toUpperCase()}
                  value={String(data.next.orders)}
                  note={data.next.orders === 1 ? "pedido" : "pedidos"}
                />
              </Link>
              <div className="pasto-panel">
                <Stat
                  label="Confirmado"
                  value={formatMoney(data.next.revenueCents)}
                  note="sin preliminares ni cancelados"
                />
              </div>
              <div className="pasto-panel">
                <Stat
                  label="Cobros pendientes"
                  value={String(data.next.unpaid)}
                  note="pedidos sin pagar"
                />
              </div>
            </div>
          ) : (
            <p className="muted">No hay pedidos para las próximas fechas.</p>
          )}
        </section>
      )}

      <section className="stack" aria-labelledby="secciones">
        <h2 id="secciones" className="heading">
          Secciones
        </h2>
        <div className="grid grid-3">
          {sections.map((section) => (
            <Link
              key={section.slug}
              href={`/admin/${section.slug}`}
              className="pasto-panel"
              style={{ textDecoration: "none" }}
            >
              <span className="title">{section.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
