import { beforeAll, describe, expect, it } from "vitest";
import { orders } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { AppDb } from "@/db/types";
import { changeOrderStatus, createManualOrder } from "./admin-orders";
import { createStaffUser } from "./auth/users";
import { listCrmTasks, resolveTask } from "./crm";
import { loadSurvey, loadSurveySummaries, saveReview } from "./survey";
import { createTestDb, productIds, TEST_NOW } from "./test-db";

let db: AppDb;
let id: (sku: string) => string;
let adminId: string;
let surveyToken: string;
let orderId: string;

const DELIVERED = new Date("2026-11-04T15:00:00-03:00");
const days = (n: number) => new Date(DELIVERED.getTime() + n * 86_400_000);

beforeAll(async () => {
  db = await createTestDb();
  id = await productIds(db);
  const admin = await createStaffUser(db, {
    email: "ana@pasto.test",
    password: "una-clave-larga-123",
    role: "ADMIN",
    fullName: "Ana",
  });
  if (!admin.ok) throw new Error(admin.message);
  adminId = admin.user.id;

  const created = await createManualOrder(db, {
    input: {
      cart: {
        packs: [
          {
            id: "a",
            category: "ESENCIAL",
            size: 5,
            items: [
              { productId: id("ESE-001"), quantity: 3 },
              { productId: id("ESE-003"), quantity: 2 },
            ],
          },
        ],
        complements: [{ productId: id("COM-001"), quantity: 1 }],
      },
      deliveryType: "RETIRO",
      scheduledDate: "2026-11-04",
      timeSlot: "12:00 a 14:00",
      customer: { name: "Lucía Romero", phone: "+5491155550501", email: "" },
      paymentMethod: "EFECTIVO",
    },
    actorId: adminId,
    now: TEST_NOW,
  });
  if (!created.ok) throw new Error(JSON.stringify(created));
  orderId = created.order.id;
  const [row] = await db.select().from(orders).where(eq(orders.id, orderId));
  surveyToken = row!.surveyToken;
});

describe("seguimiento y encuesta", () => {
  it("antes de entregar no hay tareas ni encuesta", async () => {
    expect(await listCrmTasks(db, DELIVERED, "HOY")).toEqual([]);
    expect(await loadSurvey(db, surveyToken, DELIVERED)).toEqual({ state: "NOT_FOUND" });
  });

  it("al entregar aparecen D+5 y D+12 en su día, no antes", async () => {
    await changeOrderStatus(db, {
      orderId,
      to: "ENTREGADO",
      role: "ADMIN",
      actorId: adminId,
      now: DELIVERED,
    });

    expect(await listCrmTasks(db, days(4), "HOY")).toEqual([]);
    expect((await listCrmTasks(db, days(4), "PROXIMAS")).map((t) => t.type)).toEqual([
      "D5_CHECKIN",
      "D12_SURVEY",
    ]);
    expect((await listCrmTasks(db, days(5), "HOY")).map((t) => t.type)).toEqual(["D5_CHECKIN"]);
    expect((await listCrmTasks(db, days(13), "HOY")).map((t) => t.type)).toEqual([
      "D5_CHECKIN",
      "D12_SURVEY",
    ]);
  });

  it("omitir exige motivo; completar queda registrado y no se repite", async () => {
    const [d5, d12] = await listCrmTasks(db, days(13), "HOY");

    expect(await resolveTask(db, { taskId: d5!.id, outcome: "OMITIDA", actorId: adminId })).toEqual(
      {
        ok: false,
        code: "REASON_REQUIRED",
      },
    );
    expect(
      await resolveTask(db, {
        taskId: d5!.id,
        outcome: "OMITIDA",
        notes: "No contesta",
        actorId: adminId,
        now: days(13),
      }),
    ).toEqual({ ok: true });
    expect(
      await resolveTask(db, { taskId: d5!.id, outcome: "COMPLETADA", actorId: adminId }),
    ).toEqual({ ok: false, code: "ALREADY_RESOLVED" });
    expect(
      await resolveTask(db, {
        taskId: "00000000-0000-4000-8000-000000000000",
        outcome: "COMPLETADA",
        actorId: adminId,
      }),
    ).toEqual({ ok: false, code: "NOT_FOUND" });

    await resolveTask(db, { taskId: d12!.id, outcome: "COMPLETADA", actorId: adminId });
    const done = await listCrmTasks(db, days(13), "HECHAS");
    expect(done.map((t) => t.status).sort()).toEqual(["COMPLETADA", "OMITIDA"]);
    expect(done.find((t) => t.status === "OMITIDA")?.resultNotes).toBe("No contesta");
    expect(await listCrmTasks(db, days(13), "HOY")).toEqual([]);
  });

  it("la encuesta lista solo los platos de los packs, sin datos del cliente", async () => {
    const survey = await loadSurvey(db, surveyToken, days(13));
    expect(survey.state).toBe("OPEN");
    if (survey.state !== "OPEN") return;
    expect(survey.dishes).toHaveLength(2);
    expect(JSON.stringify(survey)).not.toMatch(/Lucía|5491155|total|price/i);
  });

  it("guarda de a poco, edita y cuenta 'todavía no lo probé'", async () => {
    const survey = await loadSurvey(db, surveyToken, days(13));
    if (survey.state !== "OPEN") throw new Error("encuesta cerrada");
    const [first, second] = survey.dishes;

    expect(
      await saveReview(db, {
        token: surveyToken,
        productId: first!.productId,
        review: { ratingOverall: 4 },
        now: days(13),
      }),
    ).toEqual({ ok: true });
    await saveReview(db, {
      token: surveyToken,
      productId: first!.productId,
      review: { ratingOverall: 5, ratingFlavor: 4, portionSize: "ADECUADA", comments: "Rico" },
      now: days(14),
    });
    await saveReview(db, {
      token: surveyToken,
      productId: second!.productId,
      review: { notTestedYet: true },
      now: days(14),
    });

    const again = await loadSurvey(db, surveyToken, days(14));
    if (again.state !== "OPEN") throw new Error("encuesta cerrada");
    expect(again.dishes.find((d) => d.productId === first!.productId)?.review).toMatchObject({
      ratingOverall: 5,
      ratingFlavor: 4,
      comments: "Rico",
    });

    const summaries = await loadSurveySummaries(db);
    const rated = summaries.find((s) => s.productId === first!.productId);
    expect(rated).toMatchObject({ responses: 1, avgOverall: 5, avgFlavor: 4 });
    expect(summaries.find((s) => s.productId === second!.productId)).toMatchObject({
      responses: 0,
      notTested: 1,
    });
  });

  it("rechaza platos que no son del pedido, complementos, valores inválidos y tokens malos", async () => {
    const base = { token: surveyToken, now: days(14) };
    expect(
      await saveReview(db, { ...base, productId: id("PRO-002"), review: { ratingOverall: 3 } }),
    ).toEqual({ ok: false, code: "DISH_NOT_IN_ORDER" });
    expect(
      await saveReview(db, { ...base, productId: id("COM-001"), review: { ratingOverall: 3 } }),
    ).toEqual({ ok: false, code: "DISH_NOT_IN_ORDER" });
    expect(
      await saveReview(db, { ...base, productId: id("ESE-001"), review: { ratingOverall: 9 } }),
    ).toEqual({ ok: false, code: "RATING_INVALID" });
    expect(
      await saveReview(db, {
        token: "no-es-un-token",
        productId: id("ESE-001"),
        review: { ratingOverall: 3 },
      }),
    ).toEqual({ ok: false, code: "NOT_FOUND" });
  });

  it("la encuesta vence a los 60 días de la entrega", async () => {
    expect(await loadSurvey(db, surveyToken, days(59))).toMatchObject({ state: "OPEN" });
    expect(await loadSurvey(db, surveyToken, days(60))).toEqual({ state: "EXPIRED" });
    expect(
      await saveReview(db, {
        token: surveyToken,
        productId: id("ESE-001"),
        review: { ratingOverall: 3 },
        now: days(61),
      }),
    ).toEqual({ ok: false, code: "EXPIRED" });
  });
});
