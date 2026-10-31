import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Button } from "@design/react";
import { OrderEditor, type EditorInitial } from "@/components/admin/OrderEditor";
import { Notice, PageHead } from "@/components/ui";
import { getDb } from "@/db";
import { isEditableByAdmin } from "@/domain/orders";
import { getOrderDetail, type OrderDetail } from "@/server/admin-orders";
import { loadEditorData } from "@/server/admin-data";
import { requireStaff } from "@/server/auth/dal";
import { isMapsEnabled, mapsOptionsFromEnv } from "@/server/maps";

export const metadata: Metadata = { title: "Editar pedido" };

/** Convierte el pedido guardado en el estado inicial del editor. */
function toInitial(order: OrderDetail): EditorInitial {
  const packs = order.items
    .filter((item) => item.itemType !== "COMPLEMENTO")
    .map((item) => ({
      id: item.id,
      category: item.category as "ESENCIAL" | "PROTEICO" | "BURRITO",
      size: item.tierSize ?? 0,
      counts: Object.fromEntries(item.details.map((d) => [d.productId, d.quantity])),
    }));
  const complements: Record<string, number> = {};
  for (const item of order.items.filter((i) => i.itemType === "COMPLEMENTO")) {
    for (const d of item.details) {
      complements[d.productId] = (complements[d.productId] ?? 0) + d.quantity;
    }
  }

  return {
    customer: {
      name: order.customerName,
      phone: order.customerPhone,
      email: order.customerEmail ?? "",
    },
    deliveryType: order.deliveryType,
    address: {
      street: order.address?.street ?? "",
      number: order.address?.number ?? "",
      floorApt: order.address?.floorApt ?? "",
      neighborhood: order.address?.neighborhood ?? "",
      notes: order.address?.notes ?? "",
    },
    scheduledDate: order.scheduledDate,
    timeSlot: order.scheduledTimeSlot,
    // Si el envío ya tenía costo, queda cargado: así editar los platos no lo cambia sin querer.
    feeCents:
      order.deliveryType === "DELIVERY" && order.deliveryFeeStatus !== "A_CONFIRMAR"
        ? order.deliveryFeeCents
        : null,
    paymentMethod: order.paymentMethod,
    packs,
    complements,
  };
}

export default async function EditarPedidoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaff("ORDERS_MANAGE");
  const { id } = await params;
  const db = await getDb();
  const order = await getOrderDetail(db, id);
  if (!order) notFound();

  if (!isEditableByAdmin(order.status)) {
    return (
      <>
        <PageHead label="PEDIDO" title={order.orderNumber} />
        <Notice tone="brand" role="alert">
          <span>
            <strong>Este pedido ya no se puede editar.</strong> Solo se edita hasta confirmarlo. Si
            necesitás cambiarlo, volvelo a pendiente de confirmación desde el detalle.
          </span>
        </Notice>
        <div className="row">
          <Button href={`/admin/pedidos/${order.id}`}>Volver al pedido</Button>
        </div>
      </>
    );
  }

  const { catalog, days } = await loadEditorData(db, new Date(), order.scheduledDate);

  return (
    <>
      <PageHead label="PEDIDO" title={order.orderNumber} />
      <OrderEditor
        mode="edit"
        orderId={order.id}
        orderNumber={order.orderNumber}
        catalog={catalog}
        days={days}
        mapsEnabled={isMapsEnabled(mapsOptionsFromEnv())}
        initial={toInitial(order)}
      />
    </>
  );
}
