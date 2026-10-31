import { describe, expect, it } from "vitest";
import {
  ADMIN_SECTIONS,
  CAPABILITIES,
  can,
  canAccessPath,
  homeFor,
  safeNextPath,
  sectionForPath,
  sectionsFor,
} from "./permissions";

describe("permisos por rol (tabla RBAC de la especificación)", () => {
  it("ADMIN puede todo", () => {
    for (const capability of CAPABILITIES) expect(can("ADMIN", capability)).toBe(true);
  });

  it("COCINA solo ve producción y marca EN_PRODUCCION/LISTO", () => {
    const allowed = CAPABILITIES.filter((capability) => can("COCINA", capability));
    expect(allowed).toEqual(["KITCHEN_STATUS", "PRODUCTION_VIEW"]);
  });

  it("COCINA no ve importes, ni edita pedidos, ni catálogo, CRM, encuestas o usuarios", () => {
    for (const capability of [
      "FINANCIALS_VIEW",
      "ORDERS_MANAGE",
      "ORDERS_VIEW",
      "CATALOG_MANAGE",
      "CRM_VIEW",
      "SURVEYS_VIEW",
      "USERS_MANAGE",
      "AGENDA_MANAGE",
      "DASHBOARD_VIEW",
    ] as const) {
      expect(can("COCINA", capability), capability).toBe(false);
    }
  });
});

describe("rutas del backoffice", () => {
  it("el menú de cada rol sale de las mismas capacidades", () => {
    expect(sectionsFor("ADMIN")).toHaveLength(ADMIN_SECTIONS.length);
    expect(sectionsFor("COCINA").map((s) => s.slug)).toEqual(["produccion"]);
  });

  it("COCINA solo entra a producción; ADMIN entra a todo", () => {
    expect(canAccessPath("COCINA", "/admin/produccion")).toBe(true);
    expect(canAccessPath("COCINA", "/admin/produccion/2026-11-04")).toBe(true);
    for (const path of [
      "/admin/pedidos",
      "/admin/pedidos/123",
      "/admin/agenda",
      "/admin/usuarios",
      "/admin/dashboard",
    ]) {
      expect(canAccessPath("COCINA", path), path).toBe(false);
      expect(canAccessPath("ADMIN", path), path).toBe(true);
    }
  });

  it("/admin y /admin/login no exigen una sección", () => {
    expect(sectionForPath("/admin/login")).toBeNull();
    expect(canAccessPath("COCINA", "/admin")).toBe(true);
    expect(sectionForPath("/tienda/pedidos")).toBeNull();
  });

  it("cada rol arranca en una pantalla que puede ver", () => {
    for (const role of ["ADMIN", "COCINA"] as const) {
      expect(canAccessPath(role, homeFor(role))).toBe(true);
    }
  });
});

describe("safeNextPath", () => {
  it("acepta solo rutas internas del backoffice", () => {
    expect(safeNextPath("/admin/pedidos?estado=CONFIRMADO")).toBe(
      "/admin/pedidos?estado=CONFIRMADO",
    );
    expect(safeNextPath("/admin")).toBe("/admin");
  });

  it("rechaza redirecciones a otros sitios o rutas ajenas", () => {
    for (const next of [
      "https://sitio-malo.example",
      "//sitio-malo.example",
      "/admin\\..\\evil",
      "/administrador",
      "/cart",
      "javascript:alert(1)",
      "",
      null,
      undefined,
    ]) {
      expect(safeNextPath(next), String(next)).toBeNull();
    }
  });

  it("no vuelve a la pantalla de login", () => {
    expect(safeNextPath("/admin/login")).toBeNull();
    expect(safeNextPath("/admin/login?next=/admin")).toBeNull();
  });
});
