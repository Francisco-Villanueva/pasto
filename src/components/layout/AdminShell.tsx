import {
  CalendarDays,
  ChefHat,
  HeartHandshake,
  LayoutDashboard,
  LogOut,
  MessageSquareHeart,
  ReceiptText,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { logoutAction } from "@/app/admin/login/actions";
import { Icon } from "@/components/ui";
import type { StaffRole } from "@/domain/orders";
import { sectionsFor, type AdminSlug } from "@/domain/permissions";
import type { NavBadges } from "@/server/dashboard";
import { ThemeToggle } from "../ThemeToggle";
import { NavLink } from "./NavLink";

const ROLE_LABEL: Record<StaffRole, string> = { ADMIN: "Administración", COCINA: "Cocina" };

const ICONS: Record<AdminSlug, LucideIcon> = {
  dashboard: LayoutDashboard,
  pedidos: ReceiptText,
  produccion: ChefHat,
  agenda: CalendarDays,
  crm: HeartHandshake,
  encuestas: MessageSquareHeart,
  catalogo: UtensilsCrossed,
  usuarios: Users,
};

/** Grupos del menú: lo diario arriba, lo que se toca poco abajo. */
const GROUPS: { title: string; slugs: readonly AdminSlug[] }[] = [
  { title: "Hoy", slugs: ["dashboard"] },
  { title: "Operación", slugs: ["pedidos", "produccion", "agenda"] },
  { title: "Clientes", slugs: ["crm", "encuestas"] },
  { title: "Gestión", slugs: ["catalogo", "usuarios"] },
];

const BADGE_LABEL: Partial<Record<AdminSlug, string>> = {
  pedidos: "por confirmar",
  crm: "seguimientos para hacer",
};

/**
 * Estructura del backoffice. El menú sale de los permisos del rol (`domain/permissions.ts`), pero
 * ocultar un enlace no protege la ruta: la autorización real se valida en el servidor.
 */
export function AdminShell({
  role,
  current,
  account,
  badges,
  children,
}: {
  role: StaffRole;
  /** Fuerza el ítem activo (para pantallas de referencia fuera de su ruta real). */
  current?: string;
  /** Persona con sesión iniciada: muestra su nombre y el botón para salir. */
  account?: { name: string };
  /** Cantidades pendientes por sección, para el globo del menú. */
  badges?: NavBadges;
  children: ReactNode;
}) {
  const sections = sectionsFor(role);
  const badgeFor = (slug: AdminSlug) =>
    slug === "pedidos" ? badges?.pedidos : slug === "crm" ? badges?.crm : undefined;
  const initial = (account?.name ?? ROLE_LABEL[role]).trim().charAt(0).toUpperCase();

  return (
    <div className="pasto-admin">
      <aside className="pasto-side">
        <div className="pasto-side__brand">
          {/* Logo terracota sobre verde, siempre desde los archivos del manual. */}
          <Link href={`/admin/${sections[0]?.slug ?? "login"}`} aria-label="PASTO, inicio">
            {/* eslint-disable-next-line @next/next/no-img-element -- PNG de marca con ancho automático */}
            <img className="logo" src="/logos/pasto-logo-terracota.png" alt="PASTO" />
          </Link>
        </div>
        <nav className="pasto-sidenav" aria-label="Backoffice">
          {GROUPS.map((group) => {
            const items = sections.filter((s) => group.slugs.includes(s.slug));
            if (items.length === 0) return null;
            return (
              <div key={group.title} className="pasto-sidenav__group">
                <span className="pasto-sidenav__title">{group.title}</span>
                {items.map((section) => {
                  const href = `/admin/${section.slug}`;
                  return (
                    <NavLink
                      key={section.slug}
                      href={href}
                      current={current === undefined ? undefined : current === href}
                      icon={<Icon icon={ICONS[section.slug]} />}
                      badge={badgeFor(section.slug)}
                      badgeLabel={BADGE_LABEL[section.slug]}
                    >
                      {section.label}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>
        <div className="pasto-side__account">
          <span className="pasto-avatar" aria-hidden="true">
            {initial}
          </span>
          <div className="pasto-side__who">
            {account && <span className="pasto-side__name">{account.name}</span>}
            <span className="caption">{ROLE_LABEL[role]}</span>
          </div>
          <ThemeToggle iconOnly />
          {account && (
            <form action={logoutAction}>
              <button type="submit" className="pasto-iconbtn" title="Cerrar sesión">
                <LogOut size={18} strokeWidth={2} aria-hidden="true" />
                <span className="sr-only">Cerrar sesión</span>
              </button>
            </form>
          )}
        </div>
      </aside>
      <main className="page">{children}</main>
    </div>
  );
}
