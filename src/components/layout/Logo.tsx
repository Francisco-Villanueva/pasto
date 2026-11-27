import Link from "next/link";

/**
 * Logo de PASTO Meal Prep. Siempre desde los archivos del manual, nunca con la fuente.
 * - `tone="auto"`: versión clara u oscura según el tema.
 * - `tone="dark"`: siempre la versión para fondo oscuro (MEAL PREP en mostaza), como en la cabecera de la tienda.
 */
export function Logo({ href = "/", tone = "auto" }: { href?: string; tone?: "auto" | "dark" }) {
  if (tone === "dark") {
    return (
      <Link href={href} aria-label="PASTO Meal Prep, inicio">
        {/* eslint-disable-next-line @next/next/no-img-element -- PNG de marca con ancho automático */}
        <img className="logo" src="/logos/pasto-mealprep-plano-oscuro.png" alt="PASTO Meal Prep" />
      </Link>
    );
  }
  return (
    <Link href={href} aria-label="PASTO Meal Prep, inicio">
      {/* eslint-disable-next-line @next/next/no-img-element -- PNG de marca con ancho automático */}
      <img
        className="logo logo-light"
        src="/logos/pasto-mealprep-plano.png"
        alt="PASTO Meal Prep"
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className="logo logo-dark"
        src="/logos/pasto-mealprep-plano-oscuro.png"
        alt=""
        aria-hidden="true"
      />
    </Link>
  );
}
