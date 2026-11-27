import Link from "next/link";

/** Logo claro sobre fondo claro y su variante oscura sobre fondo oscuro. Siempre desde los archivos del manual, nunca con la fuente. */
export function Logo({ href = "/" }: { href?: string }) {
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
