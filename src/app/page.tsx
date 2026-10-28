import { Button, Card, Tag, Wave } from "@design/react";
import { PublicShell } from "@/components/layout/PublicShell";
import { Plate } from "@/components/ui";
import { loadStoreCatalog, loadStoreSettings } from "@/db/catalog";
import { formatMoney } from "@/domain/money";
import { startingPrice } from "@/domain/store-catalog";

// El catálogo y los ajustes los edita el admin: se refrescan cada minuto.
export const revalidate = 60;

const PACKS = [
  {
    category: "ESENCIAL",
    title: "Esencial",
    text: "Platos equilibrados de todos los días. Packs de 5, 10 y 20 viandas.",
    href: "/meal-prep",
  },
  {
    category: "PROTEICO",
    title: "Proteico",
    text: "Más proteína por porción para entrenar y recuperar. Packs de 5, 10 y 20.",
    href: "/meal-prep",
  },
  {
    category: "BURRITO",
    title: "Burritos",
    text: "Packs de 6 o 12, listos para calentar. Podés mezclar sabores.",
    href: "/burritos",
  },
] as const;

export default async function Home() {
  const [catalog, settings] = await Promise.all([loadStoreCatalog(), loadStoreSettings()]);
  const fudoUrl =
    typeof settings.fudo_url === "string" && settings.fudo_url ? settings.fudo_url : null;

  return (
    <PublicShell>
      <section className="hero">
        <span className="label">COMIDA CASERA PARA LA SEMANA</span>
        <h1 className="display-xl">Armá tu pack y olvidate de cocinar</h1>
        <Wave color="var(--terracota)" width={150} />
        <p>
          Elegí tus platos, programá el día de entrega o de retiro y mandá el pedido por WhatsApp.
          PASTO lo confirma con vos.
        </p>
        <div className="row">
          <Button href="/meal-prep" variant="ghost" className="pasto-btn--on-brand">
            Armar meal prep
          </Button>
          <Button href="/burritos" variant="ghost" className="pasto-btn--on-brand-outline">
            Ver burritos
          </Button>
        </div>
      </section>

      <section className="grid grid-3" aria-label="Packs">
        {PACKS.map((pack) => {
          const from = startingPrice(catalog, pack.category);
          return (
            <Card
              key={pack.category}
              title={pack.title}
              text={pack.text}
              media={
                <Plate name={pack.title} tone={pack.category === "PROTEICO" ? "cafe" : "verde"} />
              }
              footer={
                <>
                  {from !== null && <Tag tone="neutral">Desde {formatMoney(from)}</Tag>}
                  <Button href={pack.href} variant="secondary" small>
                    Armar pack
                  </Button>
                </>
              }
            />
          );
        })}
      </section>

      <section className="pasto-block-brand grid grid-2" style={{ alignItems: "center" }}>
        <div className="stack">
          <span className="label">CÓMO FUNCIONA</span>
          <h2 className="display-md">Pedidos para el miércoles</h2>
          <p>
            Los pedidos para el miércoles cierran el lunes a las 12:00. Si el viernes está
            habilitado, cierran el miércoles a las 12:00.
          </p>
        </div>
        <ol className="stack" style={{ margin: 0, paddingLeft: "var(--space-6)" }}>
          <li>Armás cada pack con la cantidad exacta.</li>
          <li>Elegís entrega o retiro y el horario.</li>
          <li>Enviás el pedido por WhatsApp.</li>
          <li>PASTO confirma stock, horario y forma de pago.</li>
        </ol>
      </section>

      {fudoUrl && (
        <section className="pasto-panel row-between" style={{ flexDirection: "row" }}>
          <div className="stack" style={{ gap: "var(--space-1)" }}>
            <h2 className="title">PASTO Cocina</h2>
            <p className="body-sm muted">
              Para comer hoy en el local, pedí desde nuestro sistema de salón.
            </p>
          </div>
          <Button href={fudoUrl} variant="secondary" rel="noopener">
            Ir a PASTO Cocina
          </Button>
        </section>
      )}
    </PublicShell>
  );
}
