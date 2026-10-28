"use client";

import { useEffect } from "react";
import { Copy, MessageCircle } from "lucide-react";
import { Button } from "@design/react";
import { Icon, Notice, OrderStatusBadge, PageHead, Panel, Stat, useToast } from "@/components/ui";
import type { OrderStatus } from "@/domain/orders";
import { formatMoney } from "@/domain/money";
import type { OrderConfirmation } from "@/server/order-view";

const STEPS = [
  "Mandá el mensaje por WhatsApp. Ya lo armamos con tu pedido.",
  "PASTO revisa el horario, que haya stock y acuerda con vos el pago.",
  "Cuando lo confirmemos, te avisamos por WhatsApp.",
];

/**
 * Pantalla "Pedido enviado". Al llegar desde el checkout abre WhatsApp solo; el botón queda
 * como respaldo por si el navegador lo bloquea o la persona vuelve a esta página.
 */
export function OrderSent({ order, autoOpen }: { order: OrderConfirmation; autoOpen: boolean }) {
  const { toast } = useToast();
  const opening = autoOpen && order.whatsappUrl !== null;
  const preliminary = order.status === "PRELIMINAR";

  useEffect(() => {
    if (!opening || !order.whatsappUrl) return;
    const url = order.whatsappUrl;
    const timer = setTimeout(() => {
      // Saca el parámetro para que volver atrás no abra WhatsApp otra vez.
      window.history.replaceState(null, "", window.location.pathname);
      window.location.assign(url);
    }, 1200);
    return () => clearTimeout(timer);
  }, [opening, order.whatsappUrl]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(order.message);
      toast("Mensaje copiado");
    } catch {
      toast("No pudimos copiarlo. Seleccionalo desde “Ver el mensaje”.");
    }
  }

  return (
    <>
      <PageHead label="PEDIDO" title={preliminary ? "Ya casi está" : "Tu pedido"} />
      <div className="pasto-split">
        <div className="stack-lg">
          {preliminary ? (
            <>
              <Panel label="Qué sigue">
                <ol className="stack" style={{ margin: 0, paddingLeft: "var(--space-6)" }}>
                  {STEPS.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {opening && (
                  <p className="body-sm muted" role="status">
                    Abriendo WhatsApp…
                  </p>
                )}
                <div className="row">
                  {order.whatsappUrl ? (
                    <Button href={order.whatsappUrl}>
                      <Icon icon={MessageCircle} /> Abrir WhatsApp
                    </Button>
                  ) : (
                    <Button disabled>
                      <Icon icon={MessageCircle} /> Abrir WhatsApp
                    </Button>
                  )}
                  <Button variant="secondary" onClick={copy}>
                    <Icon icon={Copy} /> Copiar el mensaje
                  </Button>
                </div>
                <p className="caption muted">
                  ¿No se abrió WhatsApp? Copiá el mensaje y pegalo en el chat de PASTO.
                </p>
                <details>
                  <summary className="body-sm" style={{ cursor: "pointer", fontWeight: 700 }}>
                    Ver el mensaje
                  </summary>
                  <pre
                    className="caption"
                    style={{
                      whiteSpace: "pre-wrap",
                      fontFamily: "var(--font-sans)",
                      margin: "12px 0 0",
                    }}
                  >
                    {order.message}
                  </pre>
                </details>
              </Panel>
              <Notice>
                <span>
                  <strong>Tu pedido todavía no está confirmado.</strong> Queda como preliminar hasta
                  que nos escribas. Si no lo hacés, se cancela solo pasado un tiempo. Todavía no se
                  cobró nada.
                </span>
              </Notice>
            </>
          ) : (
            <Panel label="Estado">
              <div className="row">
                <OrderStatusBadge status={order.status as OrderStatus} />
              </div>
              <p className="muted">Si necesitás cambiar algo, escribinos por WhatsApp.</p>
            </Panel>
          )}
        </div>

        <aside className="pasto-panel pasto-sticky" aria-label="Resumen del pedido">
          <Stat label="Número de pedido" value={order.orderNumber} />
          <hr style={{ width: "100%", border: 0, borderTop: "1.5px solid var(--border)" }} />
          <ul className="pasto-list">
            {order.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <span className="body-sm muted">
            {order.deliveryDayLabel} · {order.timeSlot} ·{" "}
            {order.deliveryType === "DELIVERY" ? "Envío" : "Retiro"}
          </span>
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
          {order.deliveryFeeCents === null && order.deliveryType === "DELIVERY" && (
            <p className="caption muted">
              El envío lo confirmamos por WhatsApp y se suma al total.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
