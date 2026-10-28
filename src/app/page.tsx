import Link from "next/link";
import { ArrowRight, ChefHat, Flame, MessageCircle, Truck } from "lucide-react";
import { Button, Wave } from "@design/react";
import { PublicShell } from "@/components/layout/PublicShell";
import { Icon } from "@/components/ui";
import { loadStoreCatalog, loadStoreSettings } from "@/db/catalog";
import { formatMoney } from "@/domain/money";
import {
  formatCutoff,
  formatDeliveryDay,
  generateDeliveryDays,
  getAvailableDeliveryDays,
} from "@/domain/schedule";
import { activeProducts, startingPrice, type StoreProduct } from "@/domain/store-catalog";
import "@/styles/landing.css";

// El catálogo y los ajustes los edita el admin: se refrescan cada minuto.
export const revalidate = 60;

const PACKS = [
  {
    category: "ESENCIAL",
    title: "Esencial",
    text: "Platos equilibrados para los días de todos los días.",
    sizes: "Packs de 5, 10 y 20",
    href: "/meal-prep",
  },
  {
    category: "PROTEICO",
    title: "Proteico",
    text: "Más proteína por porción, pensado para entrenar y recuperar.",
    sizes: "Packs de 5, 10 y 20",
    href: "/meal-prep",
  },
  {
    category: "BURRITO",
    title: "Burritos",
    text: "Listos para calentar. Podés mezclar sabores dentro del pack.",
    sizes: "Packs de 6 y 12",
    href: "/burritos",
  },
] as const;

const GUARANTEES = [
  { icon: ChefHat, title: "Cocina propia", text: "Cada plato sale de la cocina de PASTO." },
  {
    icon: Flame,
    title: "Macros a la vista",
    text: "Calorías, proteínas, carbohidratos y grasas por plato.",
  },
  { icon: Truck, title: "Entrega o retiro", text: "Elegís cómo recibirlo y en qué horario." },
  {
    icon: MessageCircle,
    title: "Una persona confirma",
    text: "PASTO te escribe por WhatsApp antes de cocinar.",
  },
] as const;

const STEPS = [
  { title: "Armás tu pack", text: "Elegís los platos y la cantidad exacta de cada uno." },
  { title: "Elegís día y forma", text: "Entrega a domicilio o retiro, con horario." },
  { title: "Enviás el pedido", text: "Se abre WhatsApp con el detalle ya escrito." },
  { title: "PASTO confirma", text: "Revisa stock, horario y forma de pago con vos." },
] as const;

const FAQ = [
  {
    q: "¿Hasta cuándo puedo pedir?",
    a: "Los pedidos para el miércoles cierran el lunes a las 12:00. Si el viernes está habilitado, cierran el miércoles a las 12:00.",
  },
  {
    q: "¿Cómo se confirma mi pedido?",
    a: "Al enviarlo se abre WhatsApp con el detalle. PASTO confirma stock, horario y forma de pago antes de preparar nada.",
  },
  {
    q: "¿Tiene costo el envío?",
    a: "El retiro no tiene costo. Para el envío, el costo se calcula con tu dirección antes de que envíes el pedido.",
  },
  {
    q: "¿Puedo mezclar platos en un pack?",
    a: "Sí. Cada pack se arma con la cantidad exacta que elijas, combinando los platos disponibles.",
  },
] as const;

function nextWindow() {
  const now = new Date();
  const days = generateDeliveryDays(now, { weeks: 3, defaultSlots: [] });
  const next = getAvailableDeliveryDays(now, days)[0];
  return next ? { day: formatDeliveryDay(next.date), cutoff: formatCutoff(next.cutoffAt) } : null;
}

const MENU_CATEGORIES = ["PROTEICO", "ESENCIAL", "BURRITO"] as const;

export default async function Home() {
  const [catalog, settings] = await Promise.all([loadStoreCatalog(), loadStoreSettings()]);
  const fudoUrl =
    typeof settings.fudo_url === "string" && settings.fudo_url ? settings.fudo_url : null;
  const delivery = nextWindow();

  const menu = MENU_CATEGORIES.flatMap((category) =>
    activeProducts(catalog, category).filter(
      (p): p is StoreProduct & { macros: NonNullable<StoreProduct["macros"]> } => p.macros !== null,
    ),
  );
  const featured = menu[0];
  const rest = menu.slice(1, 7);

  return (
    <PublicShell bleed>
      <div className="landing">
        {/* Portada */}
        <section className="ld-hero">
          <div className="wrap ld-hero__grid">
            <div className="ld-hero__copy">
              <h1 className="display-xl">Tu semana resuelta, cocinada en casa</h1>
              <Wave color="var(--terracota)" width={132} />
              <p className="ld-lead">
                Viandas y burritos hechos en la cocina de PASTO. Armás tu pack, elegís entrega o
                retiro y confirmás por WhatsApp.
              </p>
              <div className="row">
                <Button href="/meal-prep" variant="ghost" className="pasto-btn--on-brand">
                  Armar meal prep
                </Button>
                <Button href="/burritos" variant="ghost" className="pasto-btn--on-brand-outline">
                  Ver burritos
                </Button>
              </div>
            </div>

            <div className="ld-hero__media">
              {/* eslint-disable-next-line @next/next/no-img-element -- recorte estático de las maquetas de marca */}
              <img
                src="/imagery/pasto-bowl.jpg"
                alt="Bowl de PASTO con vegetales, legumbres y zanahoria, con la etiqueta de la marca"
                width={785}
                height={713}
              />
              {delivery && (
                <div className="ld-window" role="note">
                  <span className="ld-window__dot" aria-hidden="true" />
                  <div>
                    <p className="ld-window__title">Próxima entrega: {delivery.day}</p>
                    <p className="ld-window__text">Pedidos abiertos hasta el {delivery.cutoff}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Garantías */}
        <section className="wrap ld-section" aria-label="Cómo trabaja PASTO">
          <ul className="ld-guarantees">
            {GUARANTEES.map((item) => (
              <li key={item.title}>
                <span className="ld-guarantees__icon">
                  <Icon icon={item.icon} size={22} />
                </span>
                <h2 className="title">{item.title}</h2>
                <p className="body-sm muted">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Packs */}
        <section className="wrap ld-section ld-packs" aria-labelledby="packs-title">
          <div className="ld-packs__head">
            <h2 id="packs-title" className="display-lg">
              Tres formas de armar tu semana
            </h2>
            <p className="muted">
              Cada pack tiene precio cerrado según la cantidad. Elegís los platos y ves el total
              antes de enviar.
            </p>
          </div>
          <ul className="ld-packs__list">
            {PACKS.map((pack) => {
              const from = startingPrice(catalog, pack.category);
              return (
                <li key={pack.category}>
                  <Link href={pack.href} className="ld-pack">
                    <div className="ld-pack__main">
                      <h3 className="display-md">{pack.title}</h3>
                      <p>{pack.text}</p>
                      <p className="body-sm muted">{pack.sizes}</p>
                    </div>
                    <div className="ld-pack__side">
                      {from !== null && (
                        <p className="ld-pack__price">
                          <span className="caption muted">Desde</span>
                          <span className="num">{formatMoney(from)}</span>
                        </p>
                      )}
                      <span className="ld-pack__go">
                        Armar pack <Icon icon={ArrowRight} size={18} />
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Macros */}
        {featured && (
          <section className="ld-band ld-band--dark" aria-labelledby="macros-title">
            <div className="wrap ld-macros">
              <div className="ld-macros__copy">
                <h2 id="macros-title" className="display-lg">
                  Cada plato con sus macros a la vista
                </h2>
                <p className="ld-lead">
                  Mirás lo que comés antes de pedir. Cada plato muestra calorías, proteínas,
                  carbohidratos y grasas por porción.
                </p>
                <Button href="/meal-prep" variant="ghost" className="pasto-btn--on-brand">
                  Ver todos los platos
                </Button>
              </div>

              <div className="ld-dish">
                <p className="caption muted">
                  {featured.category === "PROTEICO" ? "Proteico" : "Plato"}
                </p>
                <h3 className="heading">{featured.name}</h3>
                <dl className="ld-dish__macros">
                  <div>
                    <dt>Calorías</dt>
                    <dd className="num">{featured.macros.calories} kcal</dd>
                  </div>
                  <div>
                    <dt>Proteínas</dt>
                    <dd className="num">{featured.macros.protein} g</dd>
                  </div>
                  <div>
                    <dt>Carbohidratos</dt>
                    <dd className="num">{featured.macros.carbs} g</dd>
                  </div>
                  <div>
                    <dt>Grasas</dt>
                    <dd className="num">{featured.macros.fats} g</dd>
                  </div>
                </dl>
                {rest.length > 0 && (
                  <ul className="ld-dish__list">
                    {rest.map((p) => (
                      <li key={p.id}>
                        <span>{p.name}</span>
                        <span className="num muted">
                          {p.macros.protein} g prot. · {p.macros.calories} kcal
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}

        {/* Proceso */}
        <section className="wrap ld-section" aria-labelledby="proceso-title">
          <div className="ld-process">
            <div>
              <h2 id="proceso-title" className="display-lg">
                De tu pedido a tu mesa
              </h2>
              <p className="muted ld-process__note">
                Pedís hasta el corte y PASTO cocina para el día de entrega.
              </p>
            </div>
            <ol className="ld-steps">
              {STEPS.map((step, i) => (
                <li key={step.title}>
                  <span className="ld-steps__n num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="title">{step.title}</h3>
                    <p className="muted">{step.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Marca */}
        <section className="wrap ld-section ld-brand" aria-labelledby="marca-title">
          <div className="ld-brand__text">
            <h2 id="marca-title" className="display-lg">
              Hecho en cocina propia
            </h2>
            <p>
              PASTO cocina viandas, burritos y complementos para que comer bien durante la semana no
              dependa de tu tiempo. Todo llega en packaging de la marca, listo para guardar y
              calentar.
            </p>
          </div>
          <div className="ld-brand__photos">
            {/* eslint-disable @next/next/no-img-element -- recortes estáticos de las maquetas de marca */}
            <img
              className="ld-brand__wide"
              src="/imagery/pasto-delantal.jpg"
              alt="Delantal verde con el logo de PASTO"
              width={1600}
              height={880}
              loading="lazy"
            />
            <img
              src="/imagery/pasto-bolsa.jpg"
              alt="Bolsa de PASTO para llevar el pedido"
              width={806}
              height={720}
              loading="lazy"
            />
            <img
              src="/imagery/pasto-caja.jpg"
              alt="Caja de PASTO con el logo"
              width={749}
              height={752}
              loading="lazy"
            />
            {/* eslint-enable @next/next/no-img-element */}
          </div>
        </section>

        {/* Preguntas */}
        <section className="wrap ld-section ld-faq" aria-labelledby="faq-title">
          <h2 id="faq-title" className="display-lg">
            Antes de pedir
          </h2>
          <div className="ld-faq__list">
            {FAQ.map((item) => (
              <details key={item.q}>
                <summary>{item.q}</summary>
                <p className="muted">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Cierre */}
        <section className="wrap ld-section">
          <div className="ld-close">
            <div className="stack">
              <h2 className="display-lg">Armá tu primer pack</h2>
              <p>Elegís los platos, ves el total y enviás el pedido cuando quieras.</p>
            </div>
            <div className="row">
              <Button href="/meal-prep">Armar meal prep</Button>
              {fudoUrl && (
                <Button href={fudoUrl} variant="secondary" rel="noopener">
                  Pedir en el local
                </Button>
              )}
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
