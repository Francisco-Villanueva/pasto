import { Copy, MessageCircle } from "lucide-react";
import { Button } from "@design/react";
import { PublicShell } from "@/components/layout/PublicShell";
import { Icon, Notice, PageHead, Panel, Stat } from "@/components/ui";
import { formatMoney } from "@/domain/money";

const STEPS = [
  "Mandá el mensaje por WhatsApp. Ya lo armamos con tu pedido.",
  "PASTO revisa el horario, que haya stock y acuerda con vos el pago.",
  "Cuando lo confirmemos, te avisamos por WhatsApp.",
];

export default function PedidoEnviadoPage() {
  return (
    <PublicShell>
      <PageHead label="Pedido" title="Ya casi está" />
      <div className="pasto-split">
        <div className="stack-lg">
          <Panel label="Qué sigue">
            <ol className="stack" style={{ margin: 0, paddingLeft: "var(--space-6)" }}>
              {STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="row">
              <Button href="https://wa.me/">
                <Icon icon={MessageCircle} /> Abrir WhatsApp
              </Button>
              <Button variant="secondary">
                <Icon icon={Copy} /> Copiar el mensaje
              </Button>
            </div>
            <p className="caption muted">
              ¿No se abrió WhatsApp? Copiá el mensaje y pegalo en el chat de PASTO.
            </p>
          </Panel>
          <Notice>
            <span>
              <strong>Tu pedido todavía no está confirmado.</strong> Queda como preliminar hasta que
              nos escribas. Si no lo hacés, se cancela solo pasado un tiempo. Todavía no se cobró
              nada.
            </span>
          </Notice>
        </div>
        <aside className="pasto-panel pasto-sticky">
          <Stat label="Número de pedido" value="PAS-000102" />
          <hr style={{ width: "100%", border: 0, borderTop: "1.5px solid var(--border)" }} />
          <ul className="flavors" style={{ margin: 0, padding: 0, listStyle: "none" }}>
            <li>Esencial x5</li>
            <li>Burritos x6</li>
            <li>1x Pollo preparado</li>
          </ul>
          <span className="body-sm muted">Miércoles 04/11 · 12:00 a 14:00 · Envío</span>
          <div className="pasto-line">
            <span>Subtotal</span>
            <span className="num">{formatMoney(4_450_000)}</span>
          </div>
          <div className="pasto-line">
            <span>Envío</span>
            <span className="num">{formatMoney(250_000)}</span>
          </div>
          <div className="pasto-line pasto-line--total">
            <span>Total</span>
            <span className="num">{formatMoney(4_700_000)}</span>
          </div>
        </aside>
      </div>
    </PublicShell>
  );
}
