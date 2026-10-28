"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@design/react";
import { Icon } from "@/components/ui";

/** Error inesperado: no mostramos detalles técnicos y dejamos reintentar. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="wrap page">
      <div className="pasto-empty" role="alert">
        <span className="pasto-empty__icon">
          <Icon icon={TriangleAlert} size={28} />
        </span>
        <h1 className="heading">Algo salió mal</h1>
        <p className="muted">
          No pudimos completar lo que pediste. No se perdió nada: probá de nuevo y, si sigue igual,
          escribinos por WhatsApp.
        </p>
        <Button onClick={reset}>Intentar de nuevo</Button>
      </div>
    </main>
  );
}
