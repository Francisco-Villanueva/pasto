import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  History,
  MessageCircle,
  Pencil,
  Receipt,
  ShoppingBag,
  UserRound,
  Zap,
} from "lucide-react";
import { Button, Tag } from "@design/react";
import { OrderActions } from "@/components/admin/OrderActions";
import { OrderStepper } from "@/components/admin/OrderStepper";
import {
  Icon,
  Notice,
  OrderStatusBadge,
  PageHead,
  PaymentBadge,
  Panel,
  Timeline,
} from "@/components/ui";
import { getDb } from "@/db";
import { can } from "@/domain/permissions";
import { formatMoney } from "@/domain/money";
import { allowedTargets, isEditableByAdmin } from "@/domain/orders";
import { formatShortDate, formatDateTime } from "@/domain/schedule";
import { describeChange, orderActions, PAYMENT_METHOD_LABEL } from "@/lib/order-labels";
import { getOrderDetail } from "@/server/admin-orders";
import { requireStaff } from "@/server/auth/dal";

export const metadata: Metadata = { title: "Pedido" };

const CATEGORY_LABEL = {
  ESENCIAL: "Esencial",
  PROTEICO: "Proteico",
  BURRITO: "Burritos",
  COMPLEMENTO: "Complemento",
} as const;

export default async function PedidoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff("ORDERS_VIEW");
  const { id } = await params;
  const order = await getOrderDetail(await getDb(), id);
  if (!order) notFound();

  const canManage = can(user.role, "ORDERS_MANAGE");
  const actions = canManage
    ? orderActions(order.status, allowedTargets(order.status, user.role))
    : [];
  const phoneDigits = order.customerPhone.replace(/\D/g, "");

  const history = order.changes.map((change) => {
    const view = describeChange(change);
    return {
      id: change.id,
      when: formatDateTime(change.at),
      who: change.actor ?? "Sistema",
      what: (
        <>
          <strong>{view.title}</strong>
          {view.lines.map((line) => (
            <span key={line} style={{ display: "block" }}>
              {line}
            </span>
          ))}
        </>
      ),
    };
  });

  return (
    <>
      <Link href="/admin/pedidos" className="pasto-back">
        <Icon icon={ArrowLeft} size={16} /> Volver a pedidos
      </Link>
      <div className="row-between">
        <PageHead label="PEDIDO" title={order.orderNumber} />
        {canManage && isEditableByAdmin(order.status) && (
          <Button href={`/admin/pedidos/${order.id}/editar`} variant="secondary">
            <Icon icon={Pencil} /> Editar pedido
          </Button>
        )}
      </div>

      <div className="row">
        <OrderStatusBadge status={order.status} />
        <PaymentBadge status={order.paymentStatus} />
        {order.origin === "MANUAL" && <Tag tone="outline">Cargado a mano</Tag>}
        <span className="body-sm muted">Creado el {formatDateTime(order.createdAt)}</span>
      </div>

      <OrderStepper status={order.status} />

      {order.status === "CANCELADO" && order.cancellationReason && (
        <Notice tone="brand" role="status">
          <span>
            <strong>Pedido cancelado.</strong> Motivo: {order.cancellationReason}
          </span>
        </Notice>
      )}
      {isEditableByAdmin(order.status) && canManage && (
        <Notice>
          Podés editar el pedido hasta confirmarlo. Los cambios recalculan el precio y quedan en el
          historial.
        </Notice>
      )}

      <div className="pasto-split">
        <div className="stack-lg">
          <Panel label="Contenido" icon={ShoppingBag}>
            {order.items.map((item) => (
              <div key={item.id} className="stack" style={{ gap: "var(--space-1)" }}>
                <div className="row-between">
                  <span className="title">
                    {item.itemType === "COMPLEMENTO"
                      ? "Complemento"
                      : `${CATEGORY_LABEL[item.category]} x${item.tierSize}`}
                  </span>
                  <span className="num">{formatMoney(item.totalPriceCents)}</span>
                </div>
                <ul className="pasto-list">
                  {item.details.map((detail) => (
                    <li key={detail.productId}>
                      {detail.quantity}x {detail.productName}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Panel>

          <Panel label="Entrega" icon={CalendarClock}>
            <p>
              <b>
                {formatShortDate(order.scheduledDate)} · {order.scheduledTimeSlot}
              </b>{" "}
              · {order.deliveryType === "DELIVERY" ? "Envío a domicilio" : "Retiro en el local"}
            </p>
            {order.address && (
              <p>
                {[order.address.street, order.address.number, order.address.floorApt]
                  .filter(Boolean)
                  .join(" ")}
                , {order.address.neighborhood}
                {order.address.notes && (
                  <>
                    <br />
                    <span className="muted">Referencias: {order.address.notes}</span>
                  </>
                )}
              </p>
            )}
            {order.deliveryDistanceM !== null && (
              <p className="body-sm muted">
                Distancia por calle: {(order.deliveryDistanceM / 1000).toFixed(1).replace(".", ",")}{" "}
                km
              </p>
            )}
            {order.deliveryFeeStatus === "A_CONFIRMAR" && (
              <Notice>
                El costo de envío quedó a confirmar. Editá el pedido para cargarlo cuando lo
                acuerdes con el cliente.
              </Notice>
            )}
          </Panel>

          <Panel label="Cliente" icon={UserRound}>
            <p>
              <b>{order.customerName}</b>
              <br />
              <span className="num">{order.customerPhone}</span>
              {order.customerEmail && (
                <>
                  <br />
                  {order.customerEmail}
                </>
              )}
            </p>
            <div className="row">
              <Button
                href={`https://wa.me/${phoneDigits}`}
                variant="secondary"
                small
                rel="noopener"
              >
                <Icon icon={MessageCircle} size={16} /> Abrir chat de WhatsApp
              </Button>
            </div>
          </Panel>
        </div>

        <aside className="stack pasto-sticky">
          {canManage && (
            <Panel label="Qué hacer ahora" icon={Zap} className="pasto-panel--action">
              <OrderActions
                orderId={order.id}
                actions={actions}
                paymentMethod={order.paymentMethod}
                paymentStatus={order.paymentStatus}
              />
            </Panel>
          )}

          <Panel label="Resumen" icon={Receipt}>
            <div className="pasto-line">
              <span>Subtotal</span>
              <span className="num">{formatMoney(order.subtotalCents)}</span>
            </div>
            <div className="pasto-line">
              <span>Envío</span>
              <span className="num">
                {order.deliveryFeeCents === null
                  ? "A confirmar"
                  : formatMoney(order.deliveryFeeCents)}
              </span>
            </div>
            <div className="pasto-line pasto-line--total">
              <span>Total</span>
              <span className="num">{formatMoney(order.totalCents)}</span>
            </div>
            <p className="caption muted">
              Pago: {PAYMENT_METHOD_LABEL[order.paymentMethod].toLowerCase()}
            </p>
          </Panel>

          <Panel label="Historial" icon={History}>
            <Timeline items={history} />
          </Panel>
        </aside>
      </div>
    </>
  );
}
