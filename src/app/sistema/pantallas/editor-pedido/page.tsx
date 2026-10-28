"use client";

import { useMemo, useState } from "react";
import { Button } from "@design/react";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  Counter,
  Modal,
  Notice,
  OrderStatusBadge,
  PageHead,
  PaymentBadge,
  Panel,
  Segmented,
  SelectField,
  TextareaField,
  TextField,
  Timeline,
  useToast,
} from "@/components/ui";
import { cartIssues, type Cart } from "@/domain/cart";
import { formatMoney } from "@/domain/money";
import { priceCart } from "@/domain/pricing";
import { SAMPLE_SHIPPING, sampleCatalog, samplePrices } from "@/domain/sample-catalog";
import { computeDeliveryFee } from "@/domain/shipping";

const catalog = sampleCatalog();
const prices = samplePrices();

type PackState = {
  id: string;
  category: "ESENCIAL" | "PROTEICO" | "BURRITO";
  size: number;
  counts: Record<string, number>;
};

const INITIAL_PACKS: PackState[] = [
  { id: "a", category: "ESENCIAL", size: 5, counts: { "ESE-001": 3, "ESE-003": 2 } },
  { id: "b", category: "BURRITO", size: 6, counts: { "BUR-001": 4, "BUR-002": 2 } },
];

const HISTORY = [
  {
    id: "3",
    when: "Hoy 10:42",
    who: "Ana (admin)",
    what: "Cambió la franja de 10:00 a 12:00 a 12:00 a 14:00",
  },
  {
    id: "2",
    when: "Hoy 09:15",
    who: "Ana (admin)",
    what: "Pasó de Preliminar a Pendiente de confirmación",
  },
  { id: "1", when: "Ayer 21:03", who: "Sistema", what: "Pedido creado desde la web" },
];

const PACK_LABEL = { ESENCIAL: "Esencial", PROTEICO: "Proteico", BURRITO: "Burritos" } as const;

export default function EditorPedidoPage() {
  const { toast } = useToast();
  const [packs, setPacks] = useState(INITIAL_PACKS);
  const [pollo, setPollo] = useState(1);
  const [deliveryType, setDeliveryType] = useState<"DELIVERY" | "RETIRO">("DELIVERY");
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  const cart: Cart = useMemo(
    () => ({
      packs: packs.map((pack) => ({
        id: pack.id,
        category: pack.category,
        size: pack.size,
        items: Object.entries(pack.counts)
          .filter(([, quantity]) => quantity > 0)
          .map(([productId, quantity]) => ({ productId, quantity })),
      })),
      complements: pollo > 0 ? [{ productId: "COM-001", quantity: pollo }] : [],
    }),
    [packs, pollo],
  );

  const issues = cartIssues(cart, catalog);
  const priced = priceCart(cart, prices, catalog);
  const fee = computeDeliveryFee(
    { deliveryType, distanceM: 2400 },
    { maxDistanceM: SAMPLE_SHIPPING.maxDistanceM, tiers: SAMPLE_SHIPPING.tiers },
  );
  const subtotal = priced.ok ? priced.subtotalCents : 0;
  const feeCents = fee.feeCents ?? 0;
  const canSave = issues.length === 0;

  function setCount(packId: string, sku: string, value: number) {
    setPacks((current) =>
      current.map((pack) =>
        pack.id === packId ? { ...pack, counts: { ...pack.counts, [sku]: value } } : pack,
      ),
    );
  }

  return (
    <AdminShell role="ADMIN" current="/admin/pedidos">
      <PageHead label="Pedido" title="PAS-000102" />
      <div className="row">
        <OrderStatusBadge status="PENDIENTE_CONFIRMACION" />
        <PaymentBadge status="PENDIENTE" />
        <span className="body-sm muted">Origen: web</span>
      </div>
      <Notice>
        Podés editar el pedido hasta confirmarlo. Los cambios recalculan el precio y quedan en el
        historial.
      </Notice>

      <div className="pasto-split">
        <div className="stack-lg">
          <Panel label="Cliente">
            <div className="pasto-fields-2">
              <TextField label="Nombre y apellido" defaultValue="Lucía Romero" />
              <TextField label="WhatsApp" defaultValue="+54 9 291 555 0123" />
            </div>
          </Panel>

          <section className="stack" aria-label="Packs">
            <span className="label">Packs</span>
            {packs.map((pack) => {
              const used = Object.values(pack.counts).reduce((a, b) => a + b, 0);
              const dishes = [...catalog.values()].filter((p) => p.category === pack.category);
              return (
                <Panel key={pack.id}>
                  <div className="row-between">
                    <span className="title">
                      {PACK_LABEL[pack.category]} x{pack.size}
                    </span>
                    <span className={`body-sm num ${used === pack.size ? "muted" : ""}`}>
                      {used} de {pack.size} unidades
                    </span>
                  </div>
                  {dishes.map((dish) => (
                    <div key={dish.id} className="row-between">
                      <span>{dish.name}</span>
                      <Counter
                        label={dish.name}
                        value={pack.counts[dish.id] ?? 0}
                        max={(pack.counts[dish.id] ?? 0) + (pack.size - used)}
                        onChange={(value) => setCount(pack.id, dish.id, value)}
                      />
                    </div>
                  ))}
                  <div className="row">
                    <Button
                      variant="ghost"
                      small
                      onClick={() => setPacks((c) => c.filter((p) => p.id !== pack.id))}
                    >
                      Quitar pack
                    </Button>
                  </div>
                </Panel>
              );
            })}
            <div className="row">
              <Button
                variant="secondary"
                small
                onClick={() => toast("Acá se abre el armado de un pack nuevo")}
              >
                Agregar pack
              </Button>
            </div>
            {issues.length > 0 && (
              <Notice tone="brand" role="alert">
                <strong>El pedido no se puede guardar todavía.</strong> Cada pack tiene que sumar
                exactamente sus unidades, y los complementos necesitan al menos un pack.
              </Notice>
            )}
          </section>

          <Panel label="Complementos">
            <div className="row-between">
              <span>Pollo preparado · 3 × 160 g</span>
              <Counter label="Pollo preparado" value={pollo} onChange={setPollo} />
            </div>
          </Panel>

          <Panel label="Entrega">
            <Segmented
              label="Tipo de entrega"
              value={deliveryType}
              onChange={setDeliveryType}
              options={[
                { value: "DELIVERY", label: "Envío a domicilio" },
                { value: "RETIRO", label: "Retiro en el local" },
              ]}
            />
            {deliveryType === "DELIVERY" && (
              <>
                <div className="pasto-fields-2">
                  <TextField label="Calle" defaultValue="Alsina" />
                  <TextField label="Número" defaultValue="456" />
                  <TextField label="Piso y depto" defaultValue="" />
                  <TextField label="Barrio" defaultValue="Centro" />
                </div>
                <TextareaField label="Referencias" defaultValue="Timbre 2B, portero eléctrico" />
                <p className="body-sm muted">
                  Distancia por calle: 2,4 km. El costo sale de los tramos de la agenda.
                </p>
              </>
            )}
            <div className="pasto-fields-2">
              <SelectField label="Día" defaultValue="0411">
                <option value="0411">Miércoles 04/11</option>
                <option value="1811">Miércoles 11/11</option>
              </SelectField>
              <SelectField label="Franja horaria" defaultValue="12">
                <option value="10">10:00 a 12:00</option>
                <option value="12">12:00 a 14:00</option>
              </SelectField>
            </div>
          </Panel>

          <Panel label="Pago">
            <SelectField label="Medio de pago" defaultValue="PENDIENTE">
              <option value="PENDIENTE">A definir</option>
              <option value="EFECTIVO">Efectivo</option>
              <option value="TRANSFERENCIA">Transferencia</option>
            </SelectField>
          </Panel>
        </div>

        <aside className="stack pasto-sticky">
          <Panel label="Resumen">
            <div className="pasto-line">
              <span>Subtotal</span>
              <span className="num">{formatMoney(subtotal)}</span>
            </div>
            <div className="pasto-line">
              <span>Envío</span>
              <span className="num">
                {fee.status === "CALCULATED" || fee.status === "PICKUP"
                  ? formatMoney(feeCents)
                  : "A confirmar"}
              </span>
            </div>
            <div className="pasto-line pasto-line--total">
              <span>Total</span>
              <span className="num">{formatMoney(subtotal + feeCents)}</span>
            </div>
            <Button disabled={!canSave} onClick={() => toast("Cambios guardados")}>
              Guardar cambios
            </Button>
            <Button variant="secondary" disabled={!canSave}>
              Confirmar pedido
            </Button>
            <Button variant="ghost" onClick={() => setCancelOpen(true)}>
              Cancelar con motivo
            </Button>
          </Panel>
          <Panel label="Historial">
            <Timeline items={HISTORY} />
          </Panel>
        </aside>
      </div>

      <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancelar el pedido">
        <p className="muted">El motivo es obligatorio y queda guardado en el historial.</p>
        <TextareaField
          label="Motivo"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          error={reason.trim() ? undefined : "Escribí el motivo de la cancelación."}
        />
        <div className="row">
          <Button
            disabled={!reason.trim()}
            onClick={() => {
              setCancelOpen(false);
              toast("Pedido cancelado");
            }}
          >
            Cancelar pedido
          </Button>
          <Button variant="secondary" onClick={() => setCancelOpen(false)}>
            Volver
          </Button>
        </div>
      </Modal>
    </AdminShell>
  );
}
