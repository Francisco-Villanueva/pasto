"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Enlace de navegación que se marca como página actual con aria-current. */
export function NavLink({
  href,
  current,
  badge,
  badgeLabel,
  icon,
  children,
}: {
  href: string;
  /** Fuerza el estado (para pantallas de referencia fuera de su ruta real). */
  current?: boolean;
  /** Cantidad de cosas que esperan una acción en esta sección; no se muestra si es 0. */
  badge?: number;
  /** Texto para lectores de pantalla del globo, por ejemplo "por confirmar". */
  badgeLabel?: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = current ?? (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <Link
      href={href}
      title={typeof children === "string" ? children : undefined}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      <span className="pasto-sidenav__text">{children}</span>
      {badge ? (
        <span className="pasto-sidenav__badge">
          {badge > 99 ? "99+" : badge}
          <span className="sr-only"> {badgeLabel}</span>
        </span>
      ) : null}
    </Link>
  );
}
