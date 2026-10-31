import { beforeAll, describe, expect, it } from "vitest";
import type { AppDb } from "@/db/types";
import { createStaffUser } from "./auth/users";
import { authenticate } from "./auth/login";
import { createSession, findSession } from "./auth/sessions";
import { listStaffUsers, resetStaffPassword, setStaffActive, setStaffRole } from "./staff-users";
import { createTestDb } from "./test-db";

let db: AppDb;
let adminId: string;
let cocinaId: string;

async function make(email: string, role: "ADMIN" | "COCINA") {
  const r = await createStaffUser(db, { email, password: "una-clave-larga-123", role });
  if (!r.ok) throw new Error(r.message);
  return r.user.id;
}

beforeAll(async () => {
  db = await createTestDb();
  adminId = await make("ana@pasto.test", "ADMIN");
  cocinaId = await make("beto@pasto.test", "COCINA");
});

describe("usuarios del staff", () => {
  it("lista a todos ordenados por email", async () => {
    const rows = await listStaffUsers(db);
    expect(rows.map((r) => r.email)).toEqual(["ana@pasto.test", "beto@pasto.test"]);
  });

  it("la baja cierra las sesiones y se puede revertir", async () => {
    const { token } = await createSession(db, cocinaId);
    expect(await findSession(db, token)).not.toBeNull();

    expect(await setStaffActive(db, { actorId: adminId, userId: cocinaId, active: false })).toEqual(
      { ok: true },
    );
    expect(await findSession(db, token)).toBeNull();

    expect(await setStaffActive(db, { actorId: adminId, userId: cocinaId, active: true })).toEqual({
      ok: true,
    });
  });

  it("nadie se da de baja a sí mismo ni deja el sistema sin ADMIN", async () => {
    const self = await setStaffActive(db, { actorId: adminId, userId: adminId, active: false });
    expect(self).toMatchObject({ ok: false, code: "SELF" });

    const otherAdmin = await make("carla@pasto.test", "ADMIN");
    // Hay dos ADMIN: Carla puede dar de baja a Ana, pero después Ana era la última de otra forma.
    expect(
      await setStaffActive(db, { actorId: otherAdmin, userId: adminId, active: false }),
    ).toEqual({ ok: true });
    expect(
      await setStaffActive(db, { actorId: cocinaId, userId: otherAdmin, active: false }),
    ).toMatchObject({ ok: false, code: "LAST_ADMIN" });
    await setStaffActive(db, { actorId: otherAdmin, userId: adminId, active: true });
  });

  it("cambiar el rol protege al último ADMIN y cierra sus sesiones", async () => {
    const { token } = await createSession(db, cocinaId);
    expect(await setStaffRole(db, { actorId: adminId, userId: cocinaId, role: "ADMIN" })).toEqual({
      ok: true,
    });
    expect(await findSession(db, token)).toBeNull();
    expect(await setStaffRole(db, { actorId: adminId, userId: cocinaId, role: "COCINA" })).toEqual({
      ok: true,
    });
  });

  it("la nueva contraseña reemplaza la anterior, cierra sesiones y valida el largo", async () => {
    const { token } = await createSession(db, cocinaId);
    expect(await resetStaffPassword(db, { userId: cocinaId, password: "corta" })).toMatchObject({
      ok: false,
      code: "WEAK_PASSWORD",
    });

    expect(
      await resetStaffPassword(db, { userId: cocinaId, password: "otra-clave-larga-456" }),
    ).toEqual({ ok: true });
    expect(await findSession(db, token)).toBeNull();

    const nueva = await authenticate(db, {
      email: "beto@pasto.test",
      password: "otra-clave-larga-456",
    });
    expect(nueva.ok).toBe(true);
  });

  it("un usuario inexistente da NOT_FOUND", async () => {
    const ghost = "00000000-0000-4000-8000-000000000000";
    expect(
      await setStaffActive(db, { actorId: adminId, userId: ghost, active: false }),
    ).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
});
