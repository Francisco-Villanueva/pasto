"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@design/react";
import {
  Counter,
  Notice,
  Panel,
  Segmented,
  SelectField,
  TextareaField,
  TextField,
  useToast,
} from "@/components/ui";
import { cartIssues, type Cart } from "@/domain/cart";
import { PACK_SIZES, type PackCategory } from "@/domain/catalog";
import { formatMoney } from "@/domain/money";
import { priceCart } from "@/domain/pricing";
import { toDomainCatalog, toPriceTable, type StoreCatalog } from "@/domain/store-catalog";
import { parseSuggestion } from "@/lib/address";
import { adminOrderSchema } from "@/lib/admin-order-schema";
import { fieldErrors } from "@/lib/checkout-schema";
import { PAYMENT_METHOD_LABEL } from "@/lib/order-labels";
import type { AdminDayOption } from "@/server/admin-data";
import { saveOrderAction } from "@/app/admin/(panel)/pedidos/actions";
import { AddressSearch, type Suggestion } from "@/components/store/AddressSearch";
import { CATEGORY_LABEL, packLabel } from "@/components/store/labels";

export type EditorPack = {
  id: string;
  category: PackCategory;
  size: number;
  counts: Record<string, number>;
};

export type EditorInitial = {
  customer: { name: string; phone: string; email: string };
  deliveryType: "DELIVERY" | "RETIRO";
  address: {
    street: string;
    number: string;
    floorApt: string;
    neighborhood: string;
    notes: string;
  };
  scheduledDate: string;
  timeSlot: string;
  /** Costo de envío cargado, en centavos. Nulo = a confirmar o por calcular. */
  feeCents: number | null;
  paymentMethod: keyof typeof PAYMENT_METHOD_LABEL;
  packs: EditorPack[];
  complements: Record<string, number>;
};

type Props = {
  mode: "create" | "edit";
  orderId?: string;
  orderNumber?: string;
  catalog: StoreCatalog;
  days: AdminDayOption[];
  mapsEnabled: boolean;
  initial?: EditorInitial;
};

const EMPTY: EditorInitial = {
  customer: { name: "", phone: "", email: "" },
  deliveryType: "RETIRO",
  address: { street: "", number: "", floorApt: "", neighborhood: "", notes: "" },
  scheduledDate: "",
  timeSlot: "",
  feeCents: null,
  paymentMethod: "PENDIENTE",
  packs: [],
  complements: {},
};

/** "1.500" o "1500,50" → centavos. Vacío = nulo. NaN si no es un número. */
function pesosToCents(text: string): number | null {
  const clean = text.trim();
  if (clean === "") return null;
  const value = Number(clean.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) : Number.NaN;
}

const newId = () => crypto.randomUUID();

export function OrderEditor({
  mode,
  orderId,
  orderNumber,
  catalog,
  days,
  mapsEnabled,
  initial,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const start = initial ?? EMPTY;
  const firstDay = days.find((d) => d.note === null) ?? days[0];

  const [customer, setCustomer] = useState(start.customer);
  const [deliveryType, setDeliveryType] = useState(start.deliveryType);
  const [address, setAddress] = useState(start.address);
  const [placeId, setPlaceId] = useState<string | undefined>();
  const [feeText, setFeeText] = useState(
    start.feeCents === null ? "" : String(start.feeCents / 100).replace(".", ","),
  );
  const [date, setDate] = useState(start.scheduledDate || firstDay?.date || "");
  const [slot, setSlot] = useState(
    start.timeSlot ||
      days.find((d) => d.date === (start.scheduledDate || firstDay?.date))?.slots[0] ||
      "",
  );
  const [payment, setPayment] = useState(start.paymentMethod);
  const [packs, setPacks] = useState(start.packs);
  const [complements, setComplements] = useState(start.complements);
  const [newCategory, setNewCategory] = useState<PackCategory>("ESENCIAL");
  const [newSize, setNewSize] = useState<number>(5);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const domainCatalog = useMemo(() => toDomainCatalog(catalog), [catalog]);
  const prices = useMemo(() => toPriceTable(catalog), [catalog]);
  const day = days.find((d) => d.date === date);

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
      complements: Object.entries(complements)
        .filter(([, quantity]) => quantity > 0)
        .map(([productId, quantity]) => ({ productId, quantity })),
    }),
    [packs, complements],
  );

  const issues = cartIssues(cart, domainCatalog);
  const priced = priceCart(cart, prices, domainCatalog);
  const subtotal = priced.ok ? priced.subtotalCents : 0;
  const feeCents = deliveryType === "RETIRO" ? 0 : pesosToCents(feeText);
  const feeInvalid = deliveryType === "DELIVERY" && Number.isNaN(feeCents);
  const total = subtotal + (feeCents !== null && !Number.isNaN(feeCents) ? feeCents : 0);
  const complementProducts = catalog.products.filter(
    (p) => p.category === "COMPLEMENTO" && p.isActive,
  );

  function setPackCount(packId: string, productId: string, value: number) {
    setPacks((current) =>
      current.map((p) =>
        p.id === packId ? { ...p, counts: { ...p.counts, [productId]: value } } : p,
      ),
    );
  }

  function pick(suggestion: Suggestion) {
    const parsed = parseSuggestion(suggestion.main, suggestion.secondary);
    setAddress((current) => ({
      ...current,
      street: parsed.street,
      number: parsed.number,
      neighborhood: parsed.neighborhood || current.neighborhood,
    }));
    setPlaceId(suggestion.placeId);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    setMessages([]);

    const payload = {
      cart,
      deliveryType,
      address:
        deliveryType === "DELIVERY"
          ? {
              street: address.street,
              number: address.number,
              floorApt: address.floorApt || undefined,
              neighborhood: address.neighborhood,
              notes: address.notes || undefined,
            }
          : undefined,
      placeId: deliveryType === "DELIVERY" ? placeId : undefined,
      scheduledDate: date,
      timeSlot: slot,
      customer,
      deliveryFeeCents:
        deliveryType === "DELIVERY" && feeCents !== null && !Number.isNaN(feeCents)
          ? feeCents
          : null,
      paymentMethod: mode === "create" ? payment : undefined,
    };

    const checked = adminOrderSchema.safeParse(payload);
    if (!checked.success || feeInvalid) {
      setErrors({
        ...(checked.success ? {} : fieldErrors(checked.error)),
        ...(feeInvalid ? { fee: "Escribí un importe válido, por ejemplo 1500." } : {}),
      });
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      const result = await saveOrderAction({ orderId: orderId ?? null, order: checked.data });
      if (result.ok) {
        toast(mode === "create" ? `Pedido ${result.orderNumber} creado` : "Pedido guardado");
        router.push(`/admin/pedidos/${result.orderId}`);
        router.refresh();
        return;
      }
      if (result.fields) setErrors(result.fields);
      setMessages(result.messages?.length ? result.messages : [result.message]);
    } finally {
      setSaving(false);
    }
  }

  const blocked = saving || issues.length > 0 || !priced.ok;

  return (
    <form className="pasto-split" onSubmit={save} noValidate>
      <div className="stack-lg">
        <Notice>
          {mode === "edit"
            ? `Estás editando el pedido ${orderNumber}. Los cambios recalculan el precio y quedan en el historial.`
            : "Cargá el pedido que te llegó por WhatsApp. Entra como pendiente de confirmación."}
        </Notice>

        <Panel label="Cliente">
          <div className="pasto-fields-2">
            <TextField
              label="Nombre y apellido"
              value={customer.name}
              error={errors["customer.name"]}
              onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
            />
            <TextField
              label="WhatsApp"
              type="tel"
              value={customer.phone}
              error={errors["customer.phone"]}
              onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
            />
          </div>
          <TextField
            label="Email (opcional)"
            type="email"
            value={customer.email}
            error={errors["customer.email"]}
            onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
          />
        </Panel>

        <section className="stack" aria-label="Packs">
          <span className="label">PACKS</span>
          {packs.length === 0 && <p className="muted">Todavía no hay packs. Agregá uno.</p>}
          {packs.map((pack) => {
            const used = Object.values(pack.counts).reduce((a, b) => a + b, 0);
            const dishes = catalog.products.filter(
              (p) => p.category === pack.category && (p.isActive || (pack.counts[p.id] ?? 0) > 0),
            );
            return (
              <Panel key={pack.id}>
                <div className="row-between">
                  <span className="title">{packLabel(pack.category, pack.size)}</span>
                  <span className="body-sm num" role="status">
                    {used} de {pack.size} unidades
                  </span>
                </div>
                {dishes.map((dish) => (
                  <div key={dish.id} className="row-between">
                    <span>
                      {dish.name}
                      {!dish.isActive && <span className="muted"> (inactivo)</span>}
                    </span>
                    <Counter
                      label={dish.name}
                      value={pack.counts[dish.id] ?? 0}
                      max={(pack.counts[dish.id] ?? 0) + (pack.size - used)}
                      onChange={(value) => setPackCount(pack.id, dish.id, value)}
                    />
                  </div>
                ))}
                <div className="row">
                  <Button
                    variant="ghost"
                    small
                    onClick={() => setPacks((current) => current.filter((p) => p.id !== pack.id))}
                  >
                    Quitar pack
                  </Button>
                </div>
              </Panel>
            );
          })}

          <Panel>
            <span className="label">AGREGAR PACK</span>
            <div className="row" style={{ alignItems: "flex-end" }}>
              <SelectField
                label="Categoría"
                value={newCategory}
                onChange={(e) => {
                  const next = e.target.value as PackCategory;
                  setNewCategory(next);
                  setNewSize(PACK_SIZES[next][0]!);
                }}
              >
                {(Object.keys(PACK_SIZES) as PackCategory[]).map((category) => (
                  <option key={category} value={category}>
                    {CATEGORY_LABEL[category]}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Tamaño"
                value={newSize}
                onChange={(e) => setNewSize(Number(e.target.value))}
              >
                {PACK_SIZES[newCategory].map((size) => (
                  <option key={size} value={size}>
                    {size} unidades
                  </option>
                ))}
              </SelectField>
              <Button
                variant="secondary"
                onClick={() =>
                  setPacks((current) => [
                    ...current,
                    { id: newId(), category: newCategory, size: newSize, counts: {} },
                  ])
                }
              >
                Agregar pack
              </Button>
            </div>
          </Panel>

          {issues.length > 0 && (
            <Notice tone="brand" role="alert">
              <span>
                <strong>El pedido no se puede guardar todavía.</strong> Cada pack tiene que sumar
                exactamente sus unidades, no se mezclan los planes Esencial y Proteico, y los
                complementos necesitan al menos un pack.
              </span>
            </Notice>
          )}
        </section>

        <Panel label="Complementos">
          {complementProducts.map((product) => (
            <div key={product.id} className="row-between">
              <span>
                {product.name}
                {product.priceCents !== undefined && (
                  <span className="muted"> · {formatMoney(product.priceCents)}</span>
                )}
              </span>
              <Counter
                label={product.name}
                value={complements[product.id] ?? 0}
                onChange={(value) => setComplements((c) => ({ ...c, [product.id]: value }))}
              />
            </div>
          ))}
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
              {mapsEnabled && (
                <AddressSearch onSelect={pick} onEdit={() => setPlaceId(undefined)} />
              )}
              <div className="pasto-fields-2">
                <TextField
                  label="Calle"
                  value={address.street}
                  error={errors["address.street"]}
                  onChange={(e) => {
                    setAddress({ ...address, street: e.target.value });
                    setPlaceId(undefined);
                  }}
                />
                <TextField
                  label="Número"
                  value={address.number}
                  error={errors["address.number"]}
                  onChange={(e) => {
                    setAddress({ ...address, number: e.target.value });
                    setPlaceId(undefined);
                  }}
                />
                <TextField
                  label="Piso y depto"
                  value={address.floorApt}
                  onChange={(e) => setAddress({ ...address, floorApt: e.target.value })}
                />
                <TextField
                  label="Barrio"
                  value={address.neighborhood}
                  error={errors["address.neighborhood"]}
                  onChange={(e) => setAddress({ ...address, neighborhood: e.target.value })}
                />
              </div>
              <TextareaField
                label="Referencias"
                value={address.notes}
                onChange={(e) => setAddress({ ...address, notes: e.target.value })}
              />
              {errors.address && <p className="pasto-field__error">Revisá: {errors.address}</p>}
              <TextField
                label="Costo de envío ($)"
                inputMode="decimal"
                value={feeText}
                error={errors.fee}
                hint="Vacío: se calcula por distancia si elegiste la dirección en el buscador, o queda a confirmar. Con un importe, ese es el costo."
                onChange={(e) => setFeeText(e.target.value)}
              />
            </>
          )}
          <div className="pasto-fields-2">
            <SelectField
              label="Día"
              value={date}
              error={errors.scheduledDate}
              onChange={(e) => {
                const next = days.find((d) => d.date === e.target.value);
                setDate(e.target.value);
                setSlot(next?.slots[0] ?? "");
              }}
            >
              {days.map((d) => (
                <option key={d.date} value={d.date}>
                  {d.label}
                  {d.note ? ` (${d.note})` : ""}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Franja horaria"
              value={slot}
              error={errors.timeSlot}
              onChange={(e) => setSlot(e.target.value)}
            >
              {(day?.slots ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </SelectField>
          </div>
          {day?.note && (
            <p className="caption muted">
              Este día está marcado como «{day.note}»: un cliente no podría elegirlo, pero vos sí.
            </p>
          )}
        </Panel>

        {mode === "create" && (
          <Panel label="Pago">
            <SelectField
              label="Medio de pago"
              value={payment}
              onChange={(e) => setPayment(e.target.value as typeof payment)}
            >
              {Object.entries(PAYMENT_METHOD_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </Panel>
        )}
      </div>

      <aside className="stack pasto-sticky">
        <Panel label="Resumen">
          <div className="pasto-line">
            <span>Subtotal</span>
            <span className="num">{priced.ok ? formatMoney(subtotal) : "—"}</span>
          </div>
          <div className="pasto-line">
            <span>Envío</span>
            <span className="num">
              {deliveryType === "RETIRO"
                ? formatMoney(0)
                : feeCents !== null && !Number.isNaN(feeCents)
                  ? formatMoney(feeCents)
                  : placeId
                    ? "Se calcula al guardar"
                    : "A confirmar"}
            </span>
          </div>
          <div className="pasto-line pasto-line--total">
            <span>Total</span>
            <span className="num">{formatMoney(total)}</span>
          </div>

          {messages.length > 0 && (
            <Notice tone="brand" role="alert">
              <span>
                {messages.map((message) => (
                  <span key={message} style={{ display: "block" }}>
                    {message}
                  </span>
                ))}
              </span>
            </Notice>
          )}

          <Button type="submit" disabled={blocked}>
            {saving ? "Guardando…" : mode === "create" ? "Crear pedido" : "Guardar cambios"}
          </Button>
          <Button
            variant="secondary"
            href={orderId ? `/admin/pedidos/${orderId}` : "/admin/pedidos"}
          >
            Cancelar
          </Button>
        </Panel>
      </aside>
    </form>
  );
}
