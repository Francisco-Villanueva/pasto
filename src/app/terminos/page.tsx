import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";

export const metadata: Metadata = { title: "Términos" };

export default function TerminosPage() {
  return (
    <LegalPage label="LEGAL" title="Términos">
      <h2 className="heading">Cómo funcionan los pedidos</h2>
      <p>
        Tu pedido queda sujeto a confirmación de PASTO. Al enviarlo no se cobra nada: el pago se
        acuerda por WhatsApp, en efectivo o por transferencia.
      </p>
      <h2 className="heading">Días y horarios</h2>
      <p>
        Los pedidos para el miércoles cierran el lunes a las 12:00. Si el viernes está habilitado,
        cierran el miércoles a las 12:00. Todo el pedido llega en una sola fecha.
      </p>
      <h2 className="heading">Cambios y cancelaciones</h2>
      <p>Para cambiar o cancelar un pedido, escribinos por WhatsApp.</p>
    </LegalPage>
  );
}
