"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarX, ShoppingBasket } from "lucide-react";
import { Button } from "@design/react";
import {
  ChoiceOption,
  EmptyState,
  Notice,
  PageHead,
  Segmented,
  SelectField,
  Switch,
  TextareaField,
  TextField,
} from "@/components/ui";
import { cartIssues } from "@/domain/cart";
import { formatMoney } from "@/domain/money";
import { normalizeArPhone } from "@/domain/phone";
import { priceCart } from "@/domain/pricing";
import { toDomainCatalog, toPriceTable, type StoreCatalog } from "@/domain/store-catalog";
import { buildOrderMessage, type WhatsappOrder } from "@/domain/whatsapp";
import { parseSuggestion } from "@/lib/address";
import { checkoutSchema, fieldErrors } from "@/lib/checkout-schema";
import { useCartReady, useCartStore } from "@/lib/cart-store";
import type { DayOption } from "@/server/checkout-data";
import { AddressSearch, type Suggestion } from "./AddressSearch";
import { packLabel } from "./labels";
import { TurnstileField } from "./TurnstileField";

type Props = {
  catalog: StoreCatalog;
  days: DayOption[];
  /** Falta el WhatsApp de PASTO u otro ajuste: no se pueden tomar pedidos. */
  enabled: boolean;
  /** Hay búsqueda de direcciones (clave de Google configurada, o simulada en desarrollo). */
  mapsEnabled: boolean;
  storeAddress: string | null;
  turnstileSiteKey: string | null;
  /** Cliente con sesión de Google: nombre y email vienen de su cuenta. */
  account: { email: string; name: string | null } | null;
  /** Se puede ofrecer "Continuar con Google". */
  googleEnabled: boolean;
};

type Quote = {
  status: "CALCULATED" | "TO_CONFIRM" | "OUT_OF_RANGE" | "PICKUP";
  feeCents: number | null;
  distanceM: number | null;
};

type ApiError = {
  error?: { code?: string; message?: string; messages?: string[]; fields?: Record<string, string> };
};

export function CheckoutForm({
  catalog,
  days,
  enabled,
  mapsEnabled,
  storeAddress,
  turnstileSiteKey,
  account,
  googleEnabled,
}: Props) {
  const router = useRouter();
  const ready = useCartReady();
  const cart = useCartStore((state) => state.cart);

  const [deliveryType, setDeliveryType] = useState<"DELIVERY" | "RETIRO">("DELIVERY");
  const [street, setStreet] = useState("");
  const [number, setNumber] = useState("");
  const [floorApt, setFloorApt] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [notes, setNotes] = useState("");
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);

  const [date, setDate] = useState(days[0]?.date ?? "");
  const [slot, setSlot] = useState(days[0]?.slots[0] ?? "");

  const [name, setName] = useState(account?.name ?? "");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(account?.email ?? "");
  const [consent, setConsent] = useState(false);
  const [terms, setTerms] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverMessages, setServerMessages] = useState<string[]>([]);

  const domainCatalog = useMemo(() => toDomainCatalog(catalog), [catalog]);
  const prices = useMemo(() => toPriceTable(catalog), [catalog]);
  const names = useMemo(() => new Map(catalog.products.map((p) => [p.id, p.name])), [catalog]);
  const day = days.find((d) => d.date === date);

  if (!ready) {
    return (
      <>
        <PageHead label="CHECKOUT" title="Entrega y datos" />
        <p className="muted" role="status">
          Cargando tu pedido…
        </p>
      </>
    );
  }

  const issues = cartIssues(cart, domainCatalog);
  const priced = priceCart(cart, prices, domainCatalog);

  if (cart.packs.length === 0 && cart.complements.length === 0) {
    return (
      <>
        <PageHead label="CHECKOUT" title="Entrega y datos" />
        <EmptyState
          icon={ShoppingBasket}
          title="Tu carrito está vacío"
          action={{ label: "Armar meal prep", href: "/meal-prep" }}
        >
          Armá un pack de meal prep o de burritos para poder pedir.
        </EmptyState>
      </>
    );
  }

  if (days.length === 0) {
    return (
      <>
        <PageHead label="CHECKOUT" title="Entrega y datos" />
        <EmptyState
          icon={CalendarX}
          title="Por ahora no hay días de entrega abiertos"
          action={{ label: "Volver al carrito", href: "/cart" }}
        >
          Los pedidos para el miércoles cierran el lunes a las 12:00. Volvé a mirar después de ese
          horario para pedir para la semana siguiente. Tu carrito queda guardado.
        </EmptyState>
      </>
    );
  }

  const outOfRange = deliveryType === "DELIVERY" && quote?.status === "OUT_OF_RANGE";
  const feeCents: number | null =
    deliveryType === "RETIRO" ? 0 : quote?.status === "CALCULATED" ? quote.feeCents : null;
  const subtotal = priced.ok ? priced.subtotalCents : 0;
  const blocked = issues.length > 0 || !priced.ok || outOfRange || !enabled || submitting;

  function resetPlace() {
    setPlaceId(null);
    setQuote(null);
  }

  async function pick(suggestion: Suggestion) {
    const parsed = parseSuggestion(suggestion.main, suggestion.secondary);
    setStreet(parsed.street);
    setNumber(parsed.number);
    if (parsed.neighborhood) setNeighborhood(parsed.neighborhood);
    setPlaceId(suggestion.placeId);
    setQuote(null);
    setQuoting(true);
    try {
      const response = await fetch("/api/address/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: suggestion.placeId }),
      });
      setQuote(response.ok ? ((await response.json()) as Quote) : null);
    } catch {
      setQuote(null);
    } finally {
      setQuoting(false);
    }
  }

  const preview = (() => {
    if (!day || !slot || !priced.ok) return null;
    const order: WhatsappOrder = {
      orderNumber: "PAS-XXXXXX",
      items: cart.packs.map((pack) => ({
        category: pack.category,
        tierSize: pack.size,
        details: pack.items.map((item) => ({
          quantity: item.quantity,
          productName: names.get(item.productId) ?? "",
        })),
      })),
      complements: cart.complements.map((c) => ({
        quantity: c.quantity,
        productName: names.get(c.productId) ?? "",
      })),
      deliveryDayLabel: day.label,
      timeSlot: slot,
      deliveryType,
      address:
        deliveryType === "DELIVERY"
          ? { street, number, floorApt, neighborhood, notes: notes || undefined }
          : undefined,
      subtotalCents: subtotal,
      deliveryFeeCents: feeCents,
      customerName: name,
      customerPhone: normalizeArPhone(phone) ?? phone,
    };
    return buildOrderMessage(order);
  })();

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (blocked) return;
    setServerMessages([]);

    const payload = {
      cart,
      deliveryType,
      address:
        deliveryType === "DELIVERY"
          ? {
              street,
              number,
              floorApt: floorApt || undefined,
              neighborhood,
              notes: notes || undefined,
            }
          : undefined,
      placeId: deliveryType === "DELIVERY" && placeId ? placeId : undefined,
      scheduledDate: date,
      timeSlot: slot,
      customer: { name, phone, email },
      consentCommercial: consent,
      acceptTerms: terms,
      turnstileToken: turnstileToken ?? undefined,
    };

    const checked = checkoutSchema.safeParse(payload);
    if (!checked.success) {
      const found = fieldErrors(checked.error);
      setErrors(found);
      document
        .querySelector<HTMLElement>("[aria-invalid='true'], [data-field-error]")
        ?.scrollIntoView({ block: "center" });
      return;
    }
    setErrors({});

    setSubmitting(true);
    try {
      const response = await fetch("/api/orders/preliminary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(checked.data),
      });
      const data = (await response.json()) as ApiError & { access_token?: string };

      if (response.status === 201 && data.access_token) {
        useCartStore.getState().clear();
        router.push(`/pedido/${data.access_token}?enviar=1`);
        return;
      }

      if (data.error?.fields) setErrors(data.error.fields);
      setServerMessages(
        data.error?.messages ??
          (data.error?.message
            ? [data.error.message]
            : ["No pudimos enviar tu pedido. Probá de nuevo."]),
      );
      if (turnstileSiteKey) setTurnstileToken(null);
    } catch {
      setServerMessages(["No pudimos conectar. Revisá tu conexión y probá de nuevo."]);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <PageHead label="CHECKOUT" title="Entrega y datos" />
      {!enabled && (
        <Notice tone="brand" role="alert">
          Estamos terminando de configurar los pedidos. Todavía no se pueden enviar, pero tu carrito
          queda guardado.
        </Notice>
      )}

      <form className="pasto-split" onSubmit={submit} noValidate>
        <div className="stack-lg">
          <section className="stack" aria-label="Cómo lo recibís">
            <span className="label">CÓMO LO RECIBÍS</span>
            <Segmented
              label="Tipo de entrega"
              value={deliveryType}
              onChange={setDeliveryType}
              options={[
                { value: "DELIVERY", label: "Envío a domicilio" },
                { value: "RETIRO", label: "Retiro en el local" },
              ]}
            />

            {deliveryType === "DELIVERY" ? (
              <div className="stack">
                {mapsEnabled && <AddressSearch onSelect={pick} onEdit={resetPlace} />}
                <div className="pasto-fields-2">
                  <TextField
                    label="Calle"
                    value={street}
                    error={errors["address.street"]}
                    onChange={(e) => {
                      setStreet(e.target.value);
                      resetPlace();
                    }}
                  />
                  <TextField
                    label="Número"
                    value={number}
                    error={errors["address.number"]}
                    onChange={(e) => {
                      setNumber(e.target.value);
                      resetPlace();
                    }}
                  />
                </div>
                <div className="pasto-fields-2">
                  <TextField
                    label="Piso y depto (opcional)"
                    value={floorApt}
                    onChange={(e) => setFloorApt(e.target.value)}
                  />
                  <TextField
                    label="Barrio"
                    value={neighborhood}
                    error={errors["address.neighborhood"]}
                    onChange={(e) => setNeighborhood(e.target.value)}
                  />
                </div>
                <TextareaField
                  label="Referencias"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
                {errors.address && (
                  <p className="pasto-field__error" data-field-error>
                    Revisá: {errors.address}
                  </p>
                )}
                <p className="caption muted">
                  El costo del envío depende de la distancia desde nuestro local.
                  {!mapsEnabled && " Lo confirmamos por WhatsApp."}
                </p>
                {outOfRange && (
                  <Notice tone="brand" role="alert">
                    <span>
                      <strong>Todavía no llegamos a esa dirección.</strong> Podés retirar tu pedido
                      en el local sin costo.{" "}
                      <button
                        type="button"
                        className="pasto-linklike"
                        style={{ fontSize: "inherit", lineHeight: "inherit" }}
                        onClick={() => setDeliveryType("RETIRO")}
                      >
                        Elegir retiro
                      </button>
                    </span>
                  </Notice>
                )}
              </div>
            ) : (
              <Notice>
                <span>
                  Retirás sin costo{storeAddress ? ` en ${storeAddress}` : " en nuestro local"}. Te
                  confirmamos el horario por WhatsApp.
                </span>
              </Notice>
            )}
          </section>

          <section className="stack" aria-label="Día y horario">
            <span className="label">DÍA Y HORARIO</span>
            <div className="pasto-fields-2" role="radiogroup" aria-label="Día de entrega">
              {days.map((option) => (
                <ChoiceOption
                  key={option.date}
                  name="day"
                  value={option.date}
                  checked={option.date === date}
                  onChange={() => {
                    setDate(option.date);
                    setSlot(option.slots[0] ?? "");
                  }}
                  title={option.label}
                  description={`Pedí hasta el ${option.cutoff}`}
                />
              ))}
            </div>
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
            <Notice>
              Todo el pedido llega en una sola fecha. Si querés otra fecha para algún pack, hacé un
              pedido aparte.
            </Notice>
          </section>

          <section className="stack" aria-label="Tus datos">
            <span className="label">TUS DATOS</span>
            {account ? (
              <Notice role="status">
                Ingresaste con Google como <strong>{account.email}</strong>. Este pedido va a quedar
                en Mi cuenta.
              </Notice>
            ) : googleEnabled ? (
              <div>
                <Button variant="secondary" small href="/api/cuenta/google?next=/checkout">
                  Continuar con Google
                </Button>
              </div>
            ) : null}
            <div className="pasto-fields-2">
              <TextField
                label="Nombre y apellido"
                value={name}
                autoComplete="name"
                error={errors["customer.name"]}
                onChange={(e) => setName(e.target.value)}
              />
              <TextField
                label="WhatsApp"
                type="tel"
                inputMode="tel"
                value={phone}
                autoComplete="tel"
                hint="Lo usamos para confirmar tu pedido y, después de la entrega, para saber cómo te fue."
                error={errors["customer.phone"]}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <TextField
              label={account ? "Email" : "Email (opcional)"}
              type="email"
              value={email}
              readOnly={account !== null}
              autoComplete="email"
              error={errors["customer.email"]}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Switch
              label="Quiero recibir novedades y propuestas de PASTO"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <div className="stack" style={{ gap: "var(--space-1)" }}>
              <label className="pasto-switch">
                <input
                  type="checkbox"
                  role="switch"
                  checked={terms}
                  aria-invalid={errors.acceptTerms ? true : undefined}
                  onChange={(e) => setTerms(e.target.checked)}
                />
                <span>
                  Acepto los <Link href="/terminos">Términos</Link> y la{" "}
                  <Link href="/privacidad">Política de privacidad</Link>
                </span>
              </label>
              {errors.acceptTerms && (
                <span className="pasto-field__error">Revisá: {errors.acceptTerms}</span>
              )}
            </div>
          </section>

          <section className="stack" aria-label="Pago">
            <span className="label">PAGO</span>
            <p className="muted">
              Se acuerda por WhatsApp: efectivo o transferencia. PASTO confirma el pago antes de
              preparar tu pedido.
            </p>
          </section>
        </div>

        <aside className="pasto-panel pasto-sticky" aria-label="Tu pedido">
          <span className="label">TU PEDIDO</span>
          <ul className="pasto-list">
            {cart.packs.map((pack) => (
              <li key={pack.id}>{packLabel(pack.category, pack.size)}</li>
            ))}
            {cart.complements.map((c) => (
              <li key={c.productId}>
                {c.quantity}x {names.get(c.productId) ?? "Complemento"}
              </li>
            ))}
          </ul>
          <hr style={{ width: "100%", border: 0, borderTop: "1.5px solid var(--border)" }} />
          <div className="pasto-line">
            <span>Subtotal</span>
            <span className="num">{priced.ok ? formatMoney(subtotal) : "—"}</span>
          </div>
          <div className="pasto-line">
            <span>Envío</span>
            <span className="num" aria-live="polite">
              {deliveryType === "RETIRO"
                ? formatMoney(0)
                : quoting
                  ? "Calculando…"
                  : feeCents !== null
                    ? formatMoney(feeCents)
                    : "A confirmar"}
            </span>
          </div>
          <div className="pasto-line pasto-line--total">
            <span>Total</span>
            <span className="num">{formatMoney(subtotal + (feeCents ?? 0))}</span>
          </div>
          {deliveryType === "DELIVERY" && feeCents === null && !quoting && (
            <p className="caption muted">
              El envío lo confirmamos por WhatsApp y se suma al total.
            </p>
          )}

          {turnstileSiteKey && (
            <TurnstileField siteKey={turnstileSiteKey} onToken={setTurnstileToken} />
          )}

          {serverMessages.length > 0 && (
            <Notice tone="brand" role="alert">
              <span>
                {serverMessages.map((message) => (
                  <span key={message} style={{ display: "block" }}>
                    {message}
                  </span>
                ))}
              </span>
            </Notice>
          )}
          {issues.length > 0 && (
            <Notice tone="brand" role="alert">
              <span>
                Hay algo para revisar en tu carrito. <Link href="/cart">Volver al carrito</Link>
              </span>
            </Notice>
          )}

          <Button type="submit" disabled={blocked}>
            {submitting ? "Enviando…" : "Enviar pedido por WhatsApp"}
          </Button>
          <p className="caption muted">
            Tu pedido queda sujeto a confirmación de PASTO. Todavía no se cobra nada.
          </p>

          {preview && (
            <details>
              <summary className="body-sm" style={{ cursor: "pointer", fontWeight: 700 }}>
                Ver el mensaje que se envía
              </summary>
              <pre
                className="caption"
                style={{
                  whiteSpace: "pre-wrap",
                  fontFamily: "var(--font-sans)",
                  margin: "12px 0 0",
                }}
              >
                {preview}
              </pre>
            </details>
          )}
        </aside>
      </form>
    </>
  );
}
