import type { ReactNode } from "react";
import type { StaffRole } from "@/domain/orders";
import { ThemeToggle } from "../ThemeToggle";
import { Logo } from "./Logo";
import { NavLink } from "./NavLink";

type Item = { href: string; label: string; roles: readonly StaffRole[] };

const NAV: readonly Item[] = [
  { href: "/admin/dashboard", label: "Panel", roles: ["ADMIN"] },
  { href: "/admin/pedidos", label: "Pedidos", roles: ["ADMIN"] },
  { href: "/admin/produccion", label: "Producción", roles: ["ADMIN", "COCINA"] },
  { href: "/admin/agenda", label: "Agenda", roles: ["ADMIN"] },
  { href: "/admin/crm", label: "Seguimiento", roles: ["ADMIN"] },
  { href: "/admin/encuestas", label: "Encuestas", roles: ["ADMIN"] },
  { href: "/admin/catalogo", label: "Catálogo", roles: ["ADMIN"] },
  { href: "/admin/usuarios", label: "Usuarios", roles: ["ADMIN"] },
];

const ROLE_LABEL: Record<StaffRole, string> = { ADMIN: "Administración", COCINA: "Cocina" };

/**
 * Estructura del backoffice. El menú se arma según el rol, pero la autorización real
 * se valida en el servidor: ocultar un enlace no protege la ruta.
 */
export function AdminShell({
  role,
  current,
  children,
}: {
  role: StaffRole;
  /** Fuerza el ítem activo (para pantallas de referencia fuera de su ruta real). */
  current?: string;
  children: ReactNode;
}) {
  return (
    <div className="pasto-admin">
      <aside className="pasto-side">
        <Logo href="/admin/dashboard" />
        <span className="label">BACKOFFICE</span>
        <nav className="pasto-sidenav" aria-label="Backoffice">
          {NAV.filter((item) => item.roles.includes(role)).map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              current={current === undefined ? undefined : current === item.href}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="stack" style={{ gap: "var(--space-2)", alignItems: "flex-start" }}>
          <span className="caption muted">{ROLE_LABEL[role]}</span>
          <ThemeToggle />
        </div>
      </aside>
      <main className="page">{children}</main>
    </div>
  );
}
