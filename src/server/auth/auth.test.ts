import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { staffSessions, users } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { createBareDb } from "../test-db";
import { authenticate, LOCK_MINUTES, MAX_FAILED_ATTEMPTS } from "./login";
import { hashPassword, MIN_PASSWORD_LENGTH, passwordProblem, verifyPassword } from "./password";
import {
  createSession,
  destroySession,
  destroyUserSessions,
  findSession,
  SESSION_TTL_MS,
} from "./sessions";
import { createStaffUser } from "./users";

const NOW = new Date("2026-11-02T10:00:00-03:00");
const PASSWORD = "una-clave-larga-123";

let db: AppDb;

beforeAll(async () => {
  db = await createBareDb();
});

async function newUser(email: string, role: "ADMIN" | "COCINA" = "ADMIN") {
  const result = await createStaffUser(db, { email, password: PASSWORD, role, fullName: "Ana" });
  if (!result.ok) throw new Error(result.message);
  return result.user;
}

describe("contraseñas", () => {
  it("se guardan con argon2id y se verifican", async () => {
    const hash = await hashPassword(PASSWORD);
    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toContain(PASSWORD);
    expect(await verifyPassword(hash, PASSWORD)).toBe(true);
    expect(await verifyPassword(hash, "otra-clave-larga-1")).toBe(false);
  });

  it("un hash dañado cuenta como contraseña incorrecta, no como error", async () => {
    expect(await verifyPassword("no-es-un-hash", PASSWORD)).toBe(false);
  });

  it("exige un largo mínimo", () => {
    expect(passwordProblem("corta")).toContain(String(MIN_PASSWORD_LENGTH));
    expect(passwordProblem(" ".repeat(12))).not.toBeNull();
    expect(passwordProblem(PASSWORD)).toBeNull();
  });
});

describe("alta de usuarios", () => {
  it("crea el usuario con el email normalizado y sin guardar la contraseña", async () => {
    const user = await newUser("  Ana@Pasto.Example ");
    expect(user.email).toBe("ana@pasto.example");

    const [row] = await db.select().from(users).where(eq(users.id, user.id));
    expect(row?.passwordHash).not.toContain(PASSWORD);
    expect(row).toMatchObject({
      role: "ADMIN",
      isActive: true,
      failedLoginCount: 0,
      fullName: "Ana",
    });
  });

  it("rechaza emails inválidos, repetidos y contraseñas débiles", async () => {
    expect(
      await createStaffUser(db, { email: "no-es-email", password: PASSWORD, role: "ADMIN" }),
    ).toMatchObject({
      ok: false,
      error: "INVALID_EMAIL",
    });
    expect(
      await createStaffUser(db, { email: "ANA@pasto.example", password: PASSWORD, role: "ADMIN" }),
    ).toMatchObject({
      ok: false,
      error: "EMAIL_TAKEN",
    });
    expect(
      await createStaffUser(db, { email: "otra@pasto.example", password: "corta", role: "ADMIN" }),
    ).toMatchObject({
      ok: false,
      error: "WEAK_PASSWORD",
    });
  });
});

describe("login", () => {
  it("entra con las credenciales correctas (sin distinguir mayúsculas en el email)", async () => {
    await newUser("login@pasto.example", "COCINA");
    const result = await authenticate(
      db,
      { email: "LOGIN@pasto.example", password: PASSWORD },
      NOW,
    );
    expect(result).toMatchObject({
      ok: true,
      user: { email: "login@pasto.example", role: "COCINA" },
    });

    const [row] = await db.select().from(users).where(eq(users.email, "login@pasto.example"));
    expect(row?.lastLoginAt).toEqual(NOW);
  });

  it("contraseña incorrecta y email inexistente dan la misma respuesta", async () => {
    const wrongPassword = await authenticate(
      db,
      { email: "login@pasto.example", password: "mala-clave-larga-1" },
      NOW,
    );
    const unknownEmail = await authenticate(
      db,
      { email: "nadie@pasto.example", password: PASSWORD },
      NOW,
    );
    expect(wrongPassword).toEqual({ ok: false, reason: "INVALID" });
    expect(unknownEmail).toEqual(wrongPassword);
  });

  it("una cuenta desactivada no puede ingresar", async () => {
    const user = await newUser("baja@pasto.example");
    await db.update(users).set({ isActive: false }).where(eq(users.id, user.id));
    expect(
      await authenticate(db, { email: "baja@pasto.example", password: PASSWORD }, NOW),
    ).toEqual({
      ok: false,
      reason: "INVALID",
    });
  });

  it(`se bloquea ${LOCK_MINUTES} minutos tras ${MAX_FAILED_ATTEMPTS} fallos, aunque después pongan la clave correcta`, async () => {
    await newUser("bloqueo@pasto.example");
    const bad = { email: "bloqueo@pasto.example", password: "mala-clave-larga-1" };

    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
      expect(await authenticate(db, bad, NOW)).toEqual({ ok: false, reason: "INVALID" });
    }
    expect(await authenticate(db, bad, NOW)).toEqual({
      ok: false,
      reason: "LOCKED",
      retryAfterSec: LOCK_MINUTES * 60,
    });

    const good = { email: "bloqueo@pasto.example", password: PASSWORD };
    const during = new Date(NOW.getTime() + 5 * 60_000);
    expect(await authenticate(db, good, during)).toEqual({
      ok: false,
      reason: "LOCKED",
      retryAfterSec: 600,
    });

    const after = new Date(NOW.getTime() + (LOCK_MINUTES * 60 + 1) * 1000);
    expect((await authenticate(db, good, after)).ok).toBe(true);
  });

  it("un ingreso correcto reinicia el conteo de fallos", async () => {
    await newUser("conteo@pasto.example");
    const bad = { email: "conteo@pasto.example", password: "mala-clave-larga-1" };
    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) await authenticate(db, bad, NOW);

    expect(
      (await authenticate(db, { email: "conteo@pasto.example", password: PASSWORD }, NOW)).ok,
    ).toBe(true);
    for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
      expect(await authenticate(db, bad, NOW)).toEqual({ ok: false, reason: "INVALID" });
    }
  });
});

describe("sesiones", () => {
  it("crean un token, guardan solo su hash y devuelven al usuario", async () => {
    const user = await newUser("sesion@pasto.example", "COCINA");
    const { token, expiresAt } = await createSession(db, user.id, NOW);

    expect(expiresAt.getTime() - NOW.getTime()).toBe(SESSION_TTL_MS);
    const rows = await db.select().from(staffSessions).where(eq(staffSessions.userId, user.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenHash).not.toBe(token);
    expect(rows[0]?.tokenHash).toMatch(/^[0-9a-f]{64}$/);

    expect(await findSession(db, token, NOW)).toEqual({
      id: user.id,
      email: "sesion@pasto.example",
      role: "COCINA",
      fullName: "Ana",
    });
  });

  it("vencen a las 12 horas", async () => {
    const user = await newUser("vence@pasto.example");
    const { token } = await createSession(db, user.id, NOW);
    const justBefore = new Date(NOW.getTime() + SESSION_TTL_MS - 1000);
    const justAfter = new Date(NOW.getTime() + SESSION_TTL_MS + 1000);
    expect(await findSession(db, token, justBefore)).not.toBeNull();
    expect(await findSession(db, token, justAfter)).toBeNull();
  });

  it("no valen con tokens vacíos, inventados o modificados", async () => {
    const user = await newUser("falso@pasto.example");
    const { token } = await createSession(db, user.id, NOW);
    expect(await findSession(db, undefined, NOW)).toBeNull();
    expect(await findSession(db, "", NOW)).toBeNull();
    expect(await findSession(db, "x".repeat(43), NOW)).toBeNull();
    expect(
      await findSession(db, token.slice(0, -1) + (token.endsWith("a") ? "b" : "a"), NOW),
    ).toBeNull();
  });

  it("desactivar al usuario invalida su sesión al instante", async () => {
    const user = await newUser("revocada@pasto.example");
    const { token } = await createSession(db, user.id, NOW);
    expect(await findSession(db, token, NOW)).not.toBeNull();

    await db.update(users).set({ isActive: false }).where(eq(users.id, user.id));
    expect(await findSession(db, token, NOW)).toBeNull();
  });

  it("cerrar sesión borra solo esa sesión; destruir las del usuario borra todas", async () => {
    const user = await newUser("salir@pasto.example");
    const a = await createSession(db, user.id, NOW);
    const b = await createSession(db, user.id, NOW);

    await destroySession(db, a.token);
    expect(await findSession(db, a.token, NOW)).toBeNull();
    expect(await findSession(db, b.token, NOW)).not.toBeNull();

    await destroyUserSessions(db, user.id);
    expect(await findSession(db, b.token, NOW)).toBeNull();
  });

  it("al crear una sesión se limpian las vencidas de esa persona", async () => {
    const user = await newUser("limpieza@pasto.example");
    const old = await createSession(db, user.id, NOW);
    const later = new Date(NOW.getTime() + SESSION_TTL_MS + 60_000);
    await createSession(db, user.id, later);

    const rows = await db.select().from(staffSessions).where(eq(staffSessions.userId, user.id));
    expect(rows).toHaveLength(1);
    expect(await findSession(db, old.token, later)).toBeNull();
  });
});
