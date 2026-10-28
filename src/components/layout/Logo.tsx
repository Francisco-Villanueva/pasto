import Link from "next/link";

/** Logo verde sobre Arena y arena sobre Carbón. Siempre desde los archivos del manual, nunca con la fuente. */
export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} aria-label="PASTO, inicio">
      {/* eslint-disable-next-line @next/next/no-img-element -- PNG de marca con ancho automático */}
      <img className="logo logo-light" src="/logos/pasto-logo-verde.png" alt="PASTO" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="logo logo-dark" src="/logos/pasto-logo-arena.png" alt="" aria-hidden="true" />
    </Link>
  );
}
