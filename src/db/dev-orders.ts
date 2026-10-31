import { eq } from "drizzle-orm";
import { changeOrderStatus, createManualOrder } from "../server/admin-orders";
import { loadAvailableDays } from "../server/checkout-data";
import { createPreliminaryOrder } from "../server/orders";
import { loadCatalogFromDb } from "./catalog";
import { users } from "./schema";
import type { AppDb } from "./types";

/**
 * Pedidos de EJEMPLO para la base de desarrollo, creados con los mismos servicios que usa la app
 * (así prueban la validación de verdad). Solo en `dev:local`; nunca se corre contra Neon.
 */
export async function seedDemoOrders(db: AppDb): Promise<void> {
  const now = new Date();
  const day = (await loadAvailableDays(db, now))[0];
  const [admin] = await db.select().from(users).where(eq(users.email, "admin@pasto.test"));
  if (!day || !admin) return;

  const catalog = await loadCatalogFromDb(db);
  const id = (sku: string) => catalog.products.find((p) => p.sku === sku)!.id;
  const slot = day.slots[0]!;
  const distanceFor = async (placeId: string) => Number(placeId.replace("dev:", "")) || null;

  const pack = (
    packId: string,
    category: "ESENCIAL" | "PROTEICO" | "BURRITO",
    size: number,
    sku: string,
  ) => ({
    id: packId,
    category,
    size,
    items: [{ productId: id(sku), quantity: size }],
  });

  const base = {
    scheduledDate: day.date,
    timeSlot: slot,
    consentCommercial: false,
    acceptTerms: true as const,
  };

  const web = async (
    name: string,
    phone: string,
    cart: Parameters<typeof createPreliminaryOrder>[1]["cart"],
    extra: Partial<Parameters<typeof createPreliminaryOrder>[1]> = {},
  ) => {
    const result = await createPreliminaryOrder(
      db,
      { ...base, cart, deliveryType: "RETIRO", customer: { name, phone, email: "" }, ...extra },
      { now, distanceFor },
    );
    return result.ok ? result.order : null;
  };

  await web(
    "Lucía Romero",
    "+5492915550123",
    { packs: [pack("a", "ESENCIAL", 5, "ESE-001")], complements: [] },
    {
      deliveryType: "DELIVERY",
      address: { street: "Alsina", number: "456", neighborhood: "Centro", notes: "Timbre 2B" },
      placeId: "dev:1200",
    },
  );

  const martin = await web("Martín Paz", "+5491155550101", {
    packs: [pack("a", "PROTEICO", 10, "PRO-002")],
    complements: [{ productId: id("COM-001"), quantity: 1 }],
  });
  if (martin) {
    await changeOrderStatus(db, {
      orderId: martin.id,
      to: "PENDIENTE_CONFIRMACION",
      role: "ADMIN",
      actorId: admin.id,
    });
  }

  const camila = await web(
    "Camila Ortiz",
    "+5491155550102",
    {
      packs: [pack("a", "ESENCIAL", 10, "ESE-003"), pack("b", "BURRITO", 6, "BUR-001")],
      complements: [],
    },
    {
      deliveryType: "DELIVERY",
      address: { street: "Av. Colón", number: "1800", neighborhood: "Palihue" },
    },
  );
  if (camila) {
    for (const to of ["PENDIENTE_CONFIRMACION", "CONFIRMADO"] as const) {
      await changeOrderStatus(db, { orderId: camila.id, to, role: "ADMIN", actorId: admin.id });
    }
  }

  await createManualOrder(db, {
    input: {
      cart: { packs: [pack("a", "BURRITO", 12, "BUR-002")], complements: [] },
      deliveryType: "RETIRO",
      scheduledDate: day.date,
      timeSlot: slot,
      customer: { name: "Diego Ferrari", phone: "11 5555 0103", email: "" },
      paymentMethod: "EFECTIVO",
    },
    actorId: admin.id,
    now,
  });

  // Un pedido ya entregado hace 13 días: tiene vencidas las tareas de seguimiento y la encuesta abierta.
  const delivered = await createManualOrder(db, {
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
        complements: [],
      },
      deliveryType: "RETIRO",
      scheduledDate: day.date,
      timeSlot: slot,
      customer: { name: "Sofía Díaz", phone: "11 5555 0104", email: "sofia.diaz@pasto.test" },
      paymentMethod: "TRANSFERENCIA",
    },
    actorId: admin.id,
    now,
  });
  if (delivered.ok) {
    await changeOrderStatus(db, {
      orderId: delivered.order.id,
      to: "ENTREGADO",
      role: "ADMIN",
      actorId: admin.id,
      now: new Date(now.getTime() - 13 * 86_400_000),
    });
  }
}
