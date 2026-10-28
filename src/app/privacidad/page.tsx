import type { Metadata } from "next";
import { LegalPage } from "@/components/layout/LegalPage";

export const metadata: Metadata = { title: "Privacidad" };

export default function PrivacidadPage() {
  return (
    <LegalPage label="LEGAL" title="Privacidad">
      <h2 className="heading">Qué datos guardamos</h2>
      <p>
        Tu nombre, tu WhatsApp, tu email si lo dejás y la dirección de entrega. Los usamos para
        preparar y entregar tu pedido.
      </p>
      <h2 className="heading">Cómo te escribimos</h2>
      <p>
        Después de la entrega te escribimos por WhatsApp para saber cómo te fue. Las novedades y
        propuestas solo te llegan si lo aceptaste al pedir.
      </p>
      <h2 className="heading">Tus derechos</h2>
      <p>
        Podés pedirnos acceder a tus datos, corregirlos o borrarlos escribiéndonos por WhatsApp.
      </p>
    </LegalPage>
  );
}
