import Link from "next/link";
import { PublicShell } from "@/components/layout/PublicShell";
import { PageHead } from "@/components/ui";
import { ComponentsDemo } from "./ComponentsDemo";

export default function SistemaPage() {
  return (
    <PublicShell>
      <PageHead label="Verificación" title="Componentes">
        Página interna para comprobar tokens, fuentes y componentes en los temas Arena y Carbón.{" "}
        <Link href="/sistema/pantallas">Ver pantallas de referencia</Link>.
      </PageHead>
      <ComponentsDemo />
    </PublicShell>
  );
}
