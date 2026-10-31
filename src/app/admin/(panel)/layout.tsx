import { AdminShell } from "@/components/layout/AdminShell";
import { requireStaff } from "@/server/auth/dal";

/**
 * Todo lo que está acá exige una sesión válida. Cada página vuelve a pedir su permiso con
 * `requireStaff(capacidad)`: un layout no alcanza como control de acceso.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  return (
    <AdminShell role={user.role} account={{ name: user.fullName ?? user.email }}>
      {children}
    </AdminShell>
  );
}
