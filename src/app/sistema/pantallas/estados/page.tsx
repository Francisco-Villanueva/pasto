import { CalendarX, Compass, SearchX, ShoppingBasket, TriangleAlert } from "lucide-react";
import { PublicShell } from "@/components/layout/PublicShell";
import { EmptyState, PageHead } from "@/components/ui";

export default function EstadosPage() {
  return (
    <PublicShell>
      <PageHead label="Referencia" title="Estados">
        Cada estado dice qué pasó y ofrece una sola acción. Sin detalles técnicos para el cliente.
      </PageHead>

      <section className="stack" aria-label="Carrito vacío">
        <span className="label">Carrito vacío</span>
        <EmptyState
          icon={ShoppingBasket}
          title="Tu carrito está vacío"
          action={{ label: "Armar meal prep", href: "/meal-prep" }}
        >
          Armá un pack de meal prep o de burritos para empezar.
        </EmptyState>
      </section>

      <section className="stack" aria-label="Sin días de entrega">
        <span className="label">Sin días de entrega</span>
        <EmptyState
          icon={CalendarX}
          title="Por ahora no hay días de entrega abiertos"
          action={{ label: "Volver al inicio", href: "/" }}
        >
          Los pedidos para el miércoles cierran el lunes a las 12:00. Volvé a mirar después de ese
          horario para pedir para la semana siguiente.
        </EmptyState>
      </section>

      <section className="stack" aria-label="Fuera de zona">
        <span className="label">Dirección fuera de zona</span>
        <EmptyState
          icon={Compass}
          title="Todavía no llegamos a esa dirección"
          action={{ label: "Elegir retiro en el local", href: "/checkout" }}
        >
          Podés retirar tu pedido en el local sin costo.
        </EmptyState>
      </section>

      <section className="stack" aria-label="Sin resultados">
        <span className="label">Sin resultados (backoffice)</span>
        <EmptyState icon={SearchX} title="No hay pedidos con estos filtros">
          Probá con otra fecha o quitá algún filtro.
        </EmptyState>
      </section>

      <section className="stack" aria-label="Error">
        <span className="label">Error inesperado</span>
        <EmptyState icon={TriangleAlert} title="Algo salió mal">
          No pudimos completar lo que pediste. Probá de nuevo y, si sigue igual, escribinos por
          WhatsApp.
        </EmptyState>
      </section>
    </PublicShell>
  );
}
