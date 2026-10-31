import { beforeAll, describe, expect, it } from "vitest";
import { deliveryDays } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { loadAvailableDays } from "./checkout-data";
import { loadAgenda, saveGeneralSettings, saveShipping, updateDay } from "./admin-agenda";
import { loadShippingConfig } from "./shipping-config";
import { parseStoreSettings } from "@/domain/settings";
import { loadSettingsFromDb } from "@/db/catalog";
import { createTestDb, TEST_NOW } from "./test-db";

let db: AppDb;

beforeAll(async () => {
  db = await createTestDb();
});

describe("agenda", () => {
  it("muestra miércoles abiertos y viernes cerrados, y completa fechas que faltan", async () => {
    await db.delete(deliveryDays);
    const agenda = await loadAgenda(db, TEST_NOW);

    expect(agenda.days.length).toBeGreaterThanOrEqual(8);
    expect(agenda.days.filter((d) => d.weekday === "MIERCOLES").every((d) => d.isOpen)).toBe(true);
    expect(agenda.days.filter((d) => d.weekday === "VIERNES").some((d) => d.isOpen)).toBe(false);
    expect(agenda.days[0]?.slots.length).toBeGreaterThan(0);
  });

  it("abrir un viernes y cambiarle las franjas se refleja en la tienda", async () => {
    const friday = (await loadAgenda(db, TEST_NOW)).days.find(
      (d) => d.weekday === "VIERNES" && !d.cutoffPassed,
    )!;

    const result = await updateDay(db, {
      date: friday.date,
      isOpen: true,
      slots: ["19:00 a 21:00"],
    });
    expect(result).toEqual({ ok: true });

    const available = await loadAvailableDays(db, TEST_NOW);
    expect(available.find((d) => d.date === friday.date)?.slots).toEqual(["19:00 a 21:00"]);

    await updateDay(db, { date: friday.date, isOpen: false, slots: ["19:00 a 21:00"] });
    expect((await loadAvailableDays(db, TEST_NOW)).some((d) => d.date === friday.date)).toBe(false);
  });

  it("no deja abrir un día sin franjas ni editar una fecha inexistente", async () => {
    const day = (await loadAgenda(db, TEST_NOW)).days[0]!;
    expect(await updateDay(db, { date: day.date, isOpen: true, slots: [] })).toEqual({
      ok: false,
      code: "SLOTS_EMPTY_NAME",
    });
    expect(await updateDay(db, { date: "2031-01-01", isOpen: false, slots: ["A"] })).toEqual({
      ok: false,
      code: "NOT_FOUND",
    });
  });

  it("los tramos y el radio se reemplazan en conjunto y los usa el cálculo de envío", async () => {
    const saved = await saveShipping(db, {
      tiers: [
        { upToM: 2000, feeCents: 100_000 },
        { upToM: 6000, feeCents: 300_000 },
      ],
      maxDistanceM: 8000,
    });
    expect(saved).toEqual({ ok: true });

    const agenda = await loadAgenda(db, TEST_NOW);
    expect(agenda.tiers).toEqual([
      { upToM: 2000, feeCents: 100_000 },
      { upToM: 6000, feeCents: 300_000 },
    ]);
    expect(agenda.maxDistanceM).toBe(8000);

    const settings = parseStoreSettings(await loadSettingsFromDb(db));
    const config = await loadShippingConfig(db, settings);
    expect(config.maxDistanceM).toBe(8000);
    expect(config.tiers).toHaveLength(2);
  });

  it("rechaza tramos inválidos sin tocar los guardados", async () => {
    const before = (await loadAgenda(db, TEST_NOW)).tiers;
    expect(
      await saveShipping(db, { tiers: [{ upToM: 9000, feeCents: 0 }], maxDistanceM: 5000 }),
    ).toEqual({ ok: false, code: "MAX_DISTANCE_BELOW_TIERS" });
    expect((await loadAgenda(db, TEST_NOW)).tiers).toEqual(before);
  });

  it("plazo de abandono: se puede cambiar y desactivar", async () => {
    expect(
      await saveGeneralSettings(db, { abandonAfterHours: 24, defaultSlots: ["12:00 a 14:00"] }),
    ).toEqual({ ok: true });
    expect((await loadAgenda(db, TEST_NOW)).abandonAfterHours).toBe(24);

    await saveGeneralSettings(db, { abandonAfterHours: 0, defaultSlots: ["12:00 a 14:00"] });
    expect((await loadAgenda(db, TEST_NOW)).abandonAfterHours).toBeNull();

    expect(
      await saveGeneralSettings(db, { abandonAfterHours: -5, defaultSlots: ["12:00 a 14:00"] }),
    ).toEqual({ ok: false, code: "ABANDON_INVALID" });
  });
});
