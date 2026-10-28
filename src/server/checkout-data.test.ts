import { eq } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { deliveryDays } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { loadAvailableDays } from "./checkout-data";
import { createTestDb, TEST_NOW } from "./test-db";

let db: AppDb;

beforeAll(async () => {
  db = await createTestDb();
});

describe("loadAvailableDays", () => {
  it("muestra los miércoles abiertos que todavía no cerraron, con su horario de corte", async () => {
    const days = await loadAvailableDays(db, TEST_NOW);
    // El miércoles de hoy (28/10) cerró el lunes; los viernes están cerrados por defecto.
    expect(days.map((d) => d.date).slice(0, 3)).toEqual(["2026-11-04", "2026-11-11", "2026-11-18"]);
    expect(days[0]).toMatchObject({
      label: "Miércoles 04/11",
      cutoff: "lunes a las 12:00",
      slots: ["12:00 a 14:00", "18:00 a 20:00"],
    });
  });

  it("criterio 4: a las 12:01 del lunes el miércoles ya no se ofrece", async () => {
    const lunes1201 = new Date("2026-11-02T12:01:00-03:00");
    const days = await loadAvailableDays(db, lunes1201);
    expect(days.map((d) => d.date)).not.toContain("2026-11-04");
    expect(days[0]?.date).toBe("2026-11-11");
  });

  it("un viernes abierto por el admin aparece con su corte del miércoles", async () => {
    await db.update(deliveryDays).set({ isOpen: true }).where(eq(deliveryDays.date, "2026-11-06"));
    const friday = (await loadAvailableDays(db, TEST_NOW)).find((d) => d.date === "2026-11-06");
    expect(friday).toMatchObject({ label: "Viernes 06/11", cutoff: "miércoles a las 12:00" });
  });

  it("no ofrece un día cerrado ni uno sin franjas", async () => {
    await db.update(deliveryDays).set({ isOpen: false }).where(eq(deliveryDays.date, "2026-11-11"));
    await db.update(deliveryDays).set({ slots: [] }).where(eq(deliveryDays.date, "2026-11-18"));
    const dates = (await loadAvailableDays(db, TEST_NOW)).map((d) => d.date);
    expect(dates).not.toContain("2026-11-11");
    expect(dates).not.toContain("2026-11-18");
    expect(dates).toContain("2026-11-04");
  });
});
