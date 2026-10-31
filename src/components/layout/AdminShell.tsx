import type { ReactNode } from "react";
import { Button } from "@design/react";
import { logoutAction } from "@/app/admin/login/actions";
import type { StaffRole } from "@/domain/orders";
import { sectionsFor } from "@/domain/permissions";
import { ThemeToggle } from "../ThemeToggle";
import { Logo } from "./Logo";
import { NavLink } from "./NavLink";

const ROLE_LABEL: Record<StaffRole, string> = { ADMIN: "Administración", COCINA: "Cocina" };

/**
 * Estructura del backoffice. El menú sale de los permisos del rol (`domain/permissions.ts`), pero
 * ocultar un enlace no protege la ruta: la autorización real se valida en el servidor.
 */
export function AdminShell({
  role,
  current,
  account,
  children,
}: {
  role: StaffRole;
  /** Fuerza el ítem activo (para pantallas de referencia fuera de su ruta real). */
  current?: string;
  /** Persona con sesión iniciada: muestra su nombre y el botón para salir. */
  account?: { name: string };
  children: ReactNode;
}) {
  return (
    <div className="pasto-admin">
      <aside className="pasto-side">
        <Logo href={`/admin/${sectionsFor(role)[0]?.slug ?? "login"}`} />
        <span className="label">BACKOFFICE</span>
        <nav className="pasto-sidenav" aria-label="Backoffice">
          {sectionsFor(role).map((section) => {
            const href = `/admin/${section.slug}`;
            return (
              <NavLink
                key={section.slug}
                href={href}
                current={current === undefined ? undefined : current === href}
              >
                {section.label}
              </NavLink>
            );
          })}
        </nav>
        <div className="stack" style={{ gap: "var(--space-2)", alignItems: "flex-start" }}>
          {account && <span className="body-sm">{account.name}</span>}
          <span className="caption muted">{ROLE_LABEL[role]}</span>
          <ThemeToggle />
          {account && (
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" small>
                Cerrar sesión
              </Button>
            </form>
          )}
        </div>
      </aside>
      <main className="page">{children}</main>
    </div>
  );
}
