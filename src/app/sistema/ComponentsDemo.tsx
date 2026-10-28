"use client";

import { useState } from "react";
import { Copy, Download, Pencil, Printer } from "lucide-react";
import { Button, Card, Tag, Wave } from "@design/react";
import { ORDER_STATUSES } from "@/domain/orders";
import {
  ChoiceOption,
  Counter,
  EmptyState,
  Icon,
  Modal,
  Notice,
  OrderStatusBadge,
  PaymentBadge,
  Plate,
  Progress,
  SelectField,
  Segmented,
  Stat,
  Switch,
  Table,
  TextareaField,
  TextField,
  useToast,
} from "@/components/ui";
import { Compass } from "lucide-react";

const COLORS = [
  ["carbon", "var(--carbon)"],
  ["verde", "var(--verde)"],
  ["terracota", "var(--terracota)"],
  ["arena", "var(--arena)"],
  ["cafe", "var(--cafe)"],
  ["cobre", "var(--cobre)"],
  ["bosque-900", "var(--bosque-900)"],
  ["bosque-800", "var(--bosque-800)"],
] as const;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="stack" aria-label={title}>
      <span className="label">{title}</span>
      {children}
    </section>
  );
}

export function ComponentsDemo() {
  const { toast } = useToast();
  const [plan, setPlan] = useState<"ESENCIAL" | "PROTEICO">("ESENCIAL");
  const [counts, setCounts] = useState([2, 1, 0]);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");

  const size = 5;
  const total = counts.reduce((a, b) => a + b, 0);
  const dishes = ["Milanesa de pollo napolitana", "Pollo al limón con arroz", "Guiso de lentejas"];

  return (
    <div className="stack-lg" data-testid="sistema">
      <Section title="Paleta">
        <div className="grid grid-3">
          {COLORS.map(([colorName, value]) => (
            <div key={colorName} className="stack" style={{ gap: "var(--space-2)" }}>
              <div className="swatch" style={{ background: value }} />
              <span className="body-sm">{colorName}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Tipografía">
        <p className="display-md">Display Gabriel Weiss</p>
        <Wave />
        <p className="heading">Heading en Hanken Grotesk</p>
        <p className="title">Title</p>
        <p>Texto corrido con peso medio, pensado para leerse cómodo.</p>
        <p className="body-sm muted">Body small en tono atenuado.</p>
      </Section>

      <Section title="Botones y etiquetas">
        <div className="row">
          <Button>Primario</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="ghost">Ghost</Button>
          <Button disabled>Deshabilitado</Button>
        </div>
        <div className="row">
          <Tag tone="brand">Nuevo</Tag>
          <Tag>Neutral</Tag>
          <Tag tone="outline">Outline</Tag>
        </div>
      </Section>

      <Section title="Íconos (Lucide, siempre con texto)">
        <div className="row">
          <Button variant="secondary" small>
            <Icon icon={Printer} size={16} /> Imprimir
          </Button>
          <Button variant="secondary" small>
            <Icon icon={Download} size={16} /> Descargar CSV
          </Button>
          <Button variant="ghost" small>
            <Icon icon={Copy} size={16} /> Copiar mensaje
          </Button>
          <Button variant="ghost" small>
            <Icon icon={Pencil} size={16} /> Editar
          </Button>
        </div>
      </Section>

      <Section title="Armado de pack: segmentado, contador y progreso">
        <Segmented
          label="Plan"
          value={plan}
          onChange={setPlan}
          options={[
            { value: "ESENCIAL", label: "Esencial" },
            { value: "PROTEICO", label: "Proteico" },
          ]}
        />
        <div className="stack">
          {dishes.map((dish, index) => (
            <div key={dish} className="row-between pasto-panel" style={{ flexDirection: "row" }}>
              <div className="row">
                <Plate name={dish} small />
                <span className="title">{dish}</span>
              </div>
              <Counter
                label={dish}
                value={counts[index] ?? 0}
                max={(counts[index] ?? 0) + (size - total)}
                onChange={(value) =>
                  setCounts((current) => current.map((c, i) => (i === index ? value : c)))
                }
              />
            </div>
          ))}
        </div>
        <Progress value={total} max={size} label="Unidades elegidas" />
        <div className="row-between">
          <span className="body-sm muted num">
            {total} de {size} unidades
          </span>
          <Button disabled={total !== size} onClick={() => toast("Pack agregado al carrito")}>
            Agregar al carrito
          </Button>
        </div>
      </Section>

      <Section title="Campos">
        <div className="pasto-fields-2">
          <TextField
            label="Nombre y apellido"
            value={name}
            onChange={(event) => setName(event.target.value)}
            hint="Lo usamos para identificar tu pedido."
          />
          <TextField label="WhatsApp" defaultValue="" error="Falta el código de área." />
          <SelectField label="Franja horaria" defaultValue="12">
            <option value="10">10:00 a 12:00</option>
            <option value="12">12:00 a 14:00</option>
          </SelectField>
          <TextField label="Campo deshabilitado" disabled defaultValue="No editable" />
        </div>
        <TextareaField label="Referencias" placeholder="Timbre, portero, color de la puerta" />
      </Section>

      <Section title="Opciones e interruptor">
        <div className="pasto-fields-2">
          <ChoiceOption
            name="day"
            defaultChecked
            title="Miércoles 04/11"
            description="Pedí hasta el lunes a las 12:00"
          />
          <ChoiceOption
            name="day"
            disabled
            title="Viernes 06/11"
            description="No disponible esta semana"
          />
        </div>
        <Switch label="Quiero recibir novedades y propuestas de PASTO" />
      </Section>

      <Section title="Avisos">
        <Notice>
          No se pueden mezclar los planes <strong>Esencial</strong> y <strong>Proteico</strong> en
          un mismo pedido.
        </Notice>
        <Notice tone="brand" role="alert">
          <strong>Falta un pack principal.</strong> Los complementos no se pueden comprar solos.
        </Notice>
      </Section>

      <Section title="Estados de pedido (punto y rótulo)">
        <div className="row">
          {ORDER_STATUSES.map((status) => (
            <OrderStatusBadge key={status} status={status} />
          ))}
        </div>
        <div className="row">
          <PaymentBadge status="PENDIENTE" />
          <PaymentBadge status="PAGADO" />
        </div>
      </Section>

      <Section title="Tabla y dato destacado">
        <div className="grid grid-3">
          <Stat label="Ventas confirmadas" value="$184.500" note="Del miércoles 04/11" />
          <Stat label="Pedidos pendientes" value="3" />
        </div>
        <Table label="Pedidos de ejemplo">
          <thead>
            <tr>
              <th scope="col">Pedido</th>
              <th scope="col">Cliente</th>
              <th scope="col">Estado</th>
              <th scope="col" className="is-num">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <b>PAS-000102</b>
              </td>
              <td>Lucía Romero</td>
              <td>
                <OrderStatusBadge status="PENDIENTE_CONFIRMACION" />
              </td>
              <td className="is-num">$79.000</td>
            </tr>
            <tr>
              <td>
                <b>PAS-000101</b>
              </td>
              <td>Camila Ortiz</td>
              <td>
                <OrderStatusBadge status="CONFIRMADO" />
              </td>
              <td className="is-num">$58.000</td>
            </tr>
          </tbody>
        </Table>
      </Section>

      <Section title="Modal y toast">
        <div className="row">
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            Abrir modal
          </Button>
          <Button variant="secondary" onClick={() => toast("Cambios guardados")}>
            Mostrar toast
          </Button>
        </div>
        <Modal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          title="Tu carrito ya tiene un pack Esencial"
        >
          <p className="muted">
            No se pueden combinar planes en el mismo pedido. Elegí si querés conservar lo que ya
            tenés o reemplazar el pack Esencial por el Proteico. Tus burritos y complementos se
            mantienen.
          </p>
          <div className="row">
            <Button onClick={() => setModalOpen(false)}>Mantener mi carrito</Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Reemplazar el pack
            </Button>
          </div>
        </Modal>
      </Section>

      <Section title="Tarjeta, estado vacío y bloque de color">
        <div className="grid grid-3">
          <Card title="Milanesa de pollo napolitana" text="Dato de ejemplo." />
          <Card brand title="Pack Esencial x10" text="Dato de ejemplo." />
        </div>
        <EmptyState
          icon={Compass}
          title="Tu carrito está vacío"
          action={{ label: "Armar meal prep", href: "/meal-prep" }}
        >
          Armá un pack de meal prep o de burritos para empezar.
        </EmptyState>
      </Section>
    </div>
  );
}
