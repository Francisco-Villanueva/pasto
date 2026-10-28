import { describe, expect, it } from "vitest";
import {
  addDays,
  defaultCutoff,
  formatCutoff,
  formatDeliveryDay,
  generateDeliveryDays,
  getAvailableDeliveryDays,
  localDate,
  weekdayOf,
  type DeliveryDayConfig,
} from "./schedule";

const SLOTS = ["12:00 a 14:00", "18:00 a 20:00"];

function day(date: string, overrides: Partial<DeliveryDayConfig> = {}): DeliveryDayConfig {
  return { date, isOpen: true, cutoffAt: defaultCutoff(date), slots: SLOTS, ...overrides };
}

const miercoles = "2026-11-04";
const viernes = "2026-11-06";

describe("cortes", () => {
  it("las fechas de prueba caen en miércoles y viernes", () => {
    expect(weekdayOf(miercoles)).toBe("MIERCOLES");
    expect(weekdayOf(viernes)).toBe("VIERNES");
  });

  it("miércoles cierra el lunes a las 12:00 de Buenos Aires (15:00 UTC)", () => {
    expect(defaultCutoff(miercoles).toISOString()).toBe("2026-11-02T15:00:00.000Z");
  });

  it("viernes cierra el miércoles a las 12:00 de Buenos Aires", () => {
    expect(defaultCutoff(viernes).toISOString()).toBe("2026-11-04T15:00:00.000Z");
  });

  it("lunes 11:59 acepta el miércoles", () => {
    const now = new Date("2026-11-02T11:59:00-03:00");
    expect(getAvailableDeliveryDays(now, [day(miercoles)]).map((d) => d.date)).toEqual([miercoles]);
  });

  it("lunes 12:01 NO muestra el miércoles", () => {
    const now = new Date("2026-11-02T12:01:00-03:00");
    expect(getAvailableDeliveryDays(now, [day(miercoles)])).toEqual([]);
  });

  it("a las 12:00 en punto ya está cerrado", () => {
    const now = new Date("2026-11-02T12:00:00-03:00");
    expect(getAvailableDeliveryDays(now, [day(miercoles)])).toEqual([]);
  });

  it("no depende de la zona horaria del servidor: 14:59 UTC es 11:59 en Buenos Aires", () => {
    expect(
      getAvailableDeliveryDays(new Date("2026-11-02T14:59:00Z"), [day(miercoles)]),
    ).toHaveLength(1);
    expect(
      getAvailableDeliveryDays(new Date("2026-11-02T15:01:00Z"), [day(miercoles)]),
    ).toHaveLength(0);
  });

  it("viernes abierto cierra el miércoles a las 12:00", () => {
    const friday = day(viernes);
    expect(getAvailableDeliveryDays(new Date("2026-11-04T11:59:00-03:00"), [friday])).toHaveLength(
      1,
    );
    expect(getAvailableDeliveryDays(new Date("2026-11-04T12:01:00-03:00"), [friday])).toHaveLength(
      0,
    );
  });

  it("un viernes cerrado o un miércoles cerrado por feriado no aparecen aunque no haya pasado el corte", () => {
    const now = new Date("2026-10-30T10:00:00-03:00");
    expect(getAvailableDeliveryDays(now, [day(viernes, { isOpen: false })])).toEqual([]);
    expect(getAvailableDeliveryDays(now, [day(miercoles, { isOpen: false })])).toEqual([]);
  });

  it("respeta un corte movido a mano por el admin", () => {
    const extended = day(miercoles, { cutoffAt: new Date("2026-11-03T12:00:00-03:00") });
    const now = new Date("2026-11-02T18:00:00-03:00");
    expect(getAvailableDeliveryDays(now, [extended])).toHaveLength(1);
  });

  it("rechaza fechas que no son miércoles ni viernes", () => {
    expect(() => defaultCutoff("2026-11-03")).toThrow();
  });
});

describe("generateDeliveryDays", () => {
  const now = new Date("2026-10-28T10:00:00-03:00"); // miércoles

  it("propone miércoles abiertos y viernes cerrados", () => {
    const days = generateDeliveryDays(now, { weeks: 2, defaultSlots: SLOTS });
    expect(days.map((d) => [d.date, d.isOpen])).toEqual([
      ["2026-10-28", true],
      ["2026-10-30", false],
      ["2026-11-04", true],
      ["2026-11-06", false],
    ]);
  });

  it("abre solo los viernes que el admin eligió", () => {
    const days = generateDeliveryDays(now, {
      weeks: 2,
      defaultSlots: SLOTS,
      openFridays: new Set([viernes]),
    });
    expect(days.find((d) => d.date === viernes)?.isOpen).toBe(true);
    expect(days.find((d) => d.date === "2026-10-30")?.isOpen).toBe(false);
  });

  it("el miércoles de hoy ya no se puede elegir (cerró el lunes)", () => {
    const days = generateDeliveryDays(now, { weeks: 2, defaultSlots: SLOTS });
    expect(getAvailableDeliveryDays(now, days).map((d) => d.date)).toEqual(["2026-11-04"]);
  });
});

describe("fechas locales", () => {
  it("dice cuándo cierra un día, en hora argentina", () => {
    expect(formatCutoff(defaultCutoff(miercoles))).toBe("lunes a las 12:00");
    expect(formatCutoff(defaultCutoff(viernes))).toBe("miércoles a las 12:00");
  });

  it("da formato para el cliente", () => {
    expect(formatDeliveryDay(miercoles)).toBe("Miércoles 04/11");
    expect(formatDeliveryDay(viernes)).toBe("Viernes 06/11");
  });

  it("suma días sobre la fecha local", () => {
    expect(addDays("2026-11-04", 5)).toBe("2026-11-09");
    expect(addDays("2026-11-04", 12)).toBe("2026-11-16");
    expect(addDays("2026-12-28", 5)).toBe("2027-01-02");
  });

  it("la fecha local de las 23:30 en Buenos Aires es el mismo día aunque en UTC ya sea el siguiente", () => {
    expect(localDate(new Date("2026-11-04T23:30:00-03:00"))).toBe("2026-11-04");
  });
});
