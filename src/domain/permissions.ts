import type { StaffRole } from "./orders";

/**
 * Qué puede hacer cada rol (tabla RBAC de la especificación). Es la única fuente: el menú, las páginas,
 * las acciones y las rutas de la API preguntan acá. Ocultar un enlace no protege nada; el servidor valida siempre.
 */
export const CAPABILITIES = [
  "DASHBOARD_VIEW",
  "ORDERS_VIEW",
  /** Ver importes, totales y estado de pago. Cocina nunca los ve. */
  "FINANCIALS_VIEW",
  /** Cambiar estados (confirmar, entregar, cancelar), pago y editar el pedido. */
  "ORDERS_MANAGE",
  /** Solo EN_PRODUCCION y LISTO. */
  "KITCHEN_STATUS",
  "PRODUCTION_VIEW",
  "AGENDA_MANAGE",
  "CATALOG_MANAGE",
  "USERS_MANAGE",
  "CRM_VIEW",
  "SURVEYS_VIEW",
] as const;
export type Capability = (typeof CAPABILITIES)[number];

const ROLE_CAPABILITIES: Record<StaffRole, ReadonlySet<Capability>> = {
  ADMIN: new Set(CAPABILITIES),
  COCINA: new Set<Capability>(["PRODUCTION_VIEW", "KITCHEN_STATUS"]),
};

export function can(role: StaffRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role].has(capability);
}

/** Secciones del backoffice y la capacidad que exige cada una. */
export const ADMIN_SECTIONS = [
  { slug: "dashboard", label: "Panel", capability: "DASHBOARD_VIEW" },
  { slug: "pedidos", label: "Pedidos", capability: "ORDERS_VIEW" },
  { slug: "produccion", label: "Producción", capability: "PRODUCTION_VIEW" },
  { slug: "agenda", label: "Agenda", capability: "AGENDA_MANAGE" },
  { slug: "crm", label: "Seguimiento", capability: "CRM_VIEW" },
  { slug: "encuestas", label: "Encuestas", capability: "SURVEYS_VIEW" },
  { slug: "catalogo", label: "Catálogo", capability: "CATALOG_MANAGE" },
  { slug: "usuarios", label: "Usuarios", capability: "USERS_MANAGE" },
] as const satisfies readonly { slug: string; label: string; capability: Capability }[];

export type AdminSlug = (typeof ADMIN_SECTIONS)[number]["slug"];

export function sectionForPath(pathname: string) {
  const [, root, slug] = pathname.split("/");
  if (root !== "admin") return null;
  return ADMIN_SECTIONS.find((section) => section.slug === slug) ?? null;
}

/** ¿Puede este rol abrir esta ruta del backoffice? `/admin` y `/admin/login` no exigen una sección. */
export function canAccessPath(role: StaffRole, pathname: string): boolean {
  const section = sectionForPath(pathname);
  return section === null || can(role, section.capability);
}

/** Primera pantalla de cada rol al ingresar. */
export function homeFor(role: StaffRole): string {
  return role === "COCINA" ? "/admin/produccion" : "/admin/dashboard";
}

/** Secciones que se muestran en el menú de un rol. */
export function sectionsFor(role: StaffRole) {
  return ADMIN_SECTIONS.filter((section) => can(role, section.capability));
}

/**
 * Destino seguro después de ingresar: solo rutas internas del backoffice. Evita que un enlace con
 * `?next=https://sitio-malo` redirija afuera (open redirect).
 */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || next.includes("\\") || (next !== "/admin" && !next.startsWith("/admin/")))
    return null;
  if (next === "/admin/login" || next.startsWith("/admin/login?")) return null;
  return next;
}
