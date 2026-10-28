import type { ReactNode } from "react";
import { Notice, PageHead } from "@/components/ui";
import { PublicShell } from "./PublicShell";

/** Página de texto legal. El contenido es provisorio hasta que PASTO entregue los textos revisados. */
export function LegalPage({
  label,
  title,
  children,
}: {
  label: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <PublicShell>
      <PageHead label={label} title={title} />
      <Notice tone="brand" role="status">
        <span>
          <strong>Texto provisorio.</strong> Lo reemplazamos por el definitivo, revisado por PASTO,
          antes de abrir la tienda.
        </span>
      </Notice>
      <div className="stack" style={{ maxWidth: "70ch" }}>
        {children}
      </div>
    </PublicShell>
  );
}
