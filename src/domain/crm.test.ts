import { describe, expect, it } from "vitest";
import { buildCrmTasks, isSurveyOpen } from "./crm";

describe("buildCrmTasks", () => {
  it("crea D+5 y D+12 desde la fecha de entrega", () => {
    const tasks = buildCrmTasks({
      deliveredAt: new Date("2026-11-04T19:30:00-03:00"),
      scheduledDate: "2026-11-04",
    });
    expect(tasks).toEqual([
      { type: "D5_CHECKIN", scheduledFor: "2026-11-09" },
      { type: "D12_SURVEY", scheduledFor: "2026-11-16" },
    ]);
  });

  it("si falta delivered_at usa la fecha programada", () => {
    const tasks = buildCrmTasks({ deliveredAt: null, scheduledDate: "2026-11-06" });
    expect(tasks.map((t) => t.scheduledFor)).toEqual(["2026-11-11", "2026-11-18"]);
  });

  it("una entrega a las 22:00 de Buenos Aires cuenta como ese día, no como el siguiente en UTC", () => {
    const tasks = buildCrmTasks({
      deliveredAt: new Date("2026-11-04T22:00:00-03:00"),
      scheduledDate: "2026-11-04",
    });
    expect(tasks[0]?.scheduledFor).toBe("2026-11-09");
  });
});

describe("isSurveyOpen", () => {
  const deliveredAt = new Date("2026-11-04T19:00:00-03:00");

  it("no existe antes de la entrega", () => {
    expect(isSurveyOpen(null, new Date("2026-11-20T00:00:00Z"))).toBe(false);
  });

  it("está abierta hasta los 60 días", () => {
    expect(isSurveyOpen(deliveredAt, new Date("2026-11-16T00:00:00Z"))).toBe(true);
    expect(isSurveyOpen(deliveredAt, new Date("2027-01-02T00:00:00-03:00"))).toBe(true);
    expect(isSurveyOpen(deliveredAt, new Date("2027-01-04T00:00:00-03:00"))).toBe(false);
  });
});
