import { eq } from "drizzle-orm";
import { customers, orderChanges, orderItemDetails, orderItems } from "@/db/schema";
import type { AppDb } from "@/db/types";
import { numericFromCents } from "@/domain/money";
import type { DraftItem } from "@/domain/order-draft";

/** Transacción de Drizzle (la misma API que la base). */
export type Tx = Parameters<Parameters<AppDb["transaction"]>[0]>[0];

/**
 * Un cliente por teléfono. Con `consentCommercial` definido se guarda el valor más reciente; si no
 * se informa (alta manual), se conserva el que ya tenía, o falso si es nuevo.
 */
export async function upsertCustomer(
  tx: Tx,
  customer: { name: string; phone: string; email: string | null; consentCommercial?: boolean },
): Promise<string> {
  const [existing] = await tx
    .select()
    .from(customers)
    .where(eq(customers.phone, customer.phone))
    .limit(1);

  if (existing) {
    await tx
      .update(customers)
      .set({
        fullName: customer.name,
        email: customer.email ?? existing.email,
        consentCommercial: customer.consentCommercial ?? existing.consentCommercial,
      })
      .where(eq(customers.id, existing.id));
    return existing.id;
  }

  const [created] = await tx
    .insert(customers)
    .values({
      fullName: customer.name,
      phone: customer.phone,
      email: customer.email,
      consentCommercial: customer.consentCommercial ?? false,
    })
    .returning({ id: customers.id });
  return created!.id;
}

/** Guarda los packs y complementos de un pedido, cada uno con su detalle por plato. */
export async function insertItems(tx: Tx, orderId: string, items: readonly DraftItem[]) {
  for (const item of items) {
    const [row] = await tx
      .insert(orderItems)
      .values({
        orderId,
        itemType: item.itemType,
        tierSize: item.tierSize,
        category: item.category,
        unitPrice: numericFromCents(item.unitPriceCents),
        totalPrice: numericFromCents(item.totalPriceCents),
      })
      .returning({ id: orderItems.id });

    await tx.insert(orderItemDetails).values(
      item.details.map((detail) => ({
        orderItemId: row!.id,
        productId: detail.productId,
        productName: detail.productName,
        recipeVersion: detail.recipeVersion,
        quantity: detail.quantity,
      })),
    );
  }
}

/** Una línea del historial: quién, cuándo y qué cambió. `actorId` nulo = el sistema. */
export async function logChange(
  tx: Tx,
  change: {
    orderId: string;
    kind: "ESTADO" | "EDICION" | "PAGO";
    actorId: string | null;
    before?: unknown;
    after?: unknown;
    note?: string;
    at?: Date;
  },
) {
  await tx.insert(orderChanges).values({
    orderId: change.orderId,
    changedBy: change.actorId,
    kind: change.kind,
    before: change.before ?? null,
    after: change.after ?? null,
    note: change.note ?? null,
    ...(change.at ? { changedAt: change.at } : {}),
  });
}
