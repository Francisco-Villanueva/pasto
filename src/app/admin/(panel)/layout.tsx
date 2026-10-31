import { AdminShell } from "@/components/layout/AdminShell";
import { getDb } from "@/db";
import { can } from "@/domain/permissions";
import { requireStaff } from "@/server/auth/dal";
import { loadNavBadges } from "@/server/dashboard";

/**
 * Todo lo que está acá exige una sesión válida. Cada página vuelve a pedir su permiso con
 * `requireStaff(capacidad)`: un layout no alcanza como control de acceso.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  // Los globos del menú solo cuentan cosas que el rol puede abrir.
  const badges = can(user.role, "ORDERS_MANAGE")
    ? await loadNavBadges(await getDb(), new Date())
    : undefined;
  return (
    <AdminShell role={user.role} account={{ name: user.fullName ?? user.email }} badges={badges}>
      {children}
    </AdminShell>
  );
}
