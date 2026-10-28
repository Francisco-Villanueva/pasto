"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Enlace de navegación que se marca como página actual con aria-current. */
export function NavLink({
  href,
  current,
  children,
}: {
  href: string;
  /** Fuerza el estado (para pantallas de referencia fuera de su ruta real). */
  current?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = current ?? (href === "/" ? pathname === "/" : pathname.startsWith(href));
  return (
    <Link href={href} aria-current={active ? "page" : undefined}>
      {children}
    </Link>
  );
}
