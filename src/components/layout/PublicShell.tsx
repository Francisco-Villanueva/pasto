import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "../ThemeToggle";
import { Logo } from "./Logo";
import { CartNavLink } from "../store/CartNavLink";
import { NavLink } from "./NavLink";
import { BottomNav } from "./BottomNav";

const BEFORE_CART = [
  { href: "/", label: "Inicio" },
  { href: "/meal-prep", label: "Meal prep" },
  { href: "/burritos", label: "Burritos" },
] as const;

/**
 * Estructura de la tienda: cabecera con navegación y tema, contenido y pie.
 * Con `bleed` el contenido no se envuelve: la página maneja su propio ancho (la portada ocupa todo el ancho).
 */
export function PublicShell({ children, bleed = false }: { children: ReactNode; bleed?: boolean }) {
  return (
    <>
      <header className={bleed ? "v-header v-header--home" : "v-header"}>
        <div className="wrap row-between">
          <Logo />
          <nav className="pasto-nav" aria-label="Principal">
            {BEFORE_CART.map((item) => (
              <NavLink key={item.href} href={item.href}>
                {item.label}
              </NavLink>
            ))}
            <CartNavLink />
            <NavLink href="/mi-cuenta">Mi cuenta</NavLink>
            <ThemeToggle />
          </nav>
        </div>
      </header>
      {bleed ? <main>{children}</main> : <main className="wrap page">{children}</main>}
      <footer className="pasto-footer">
        <div className="wrap pasto-footer__grid">
          <div className="stack">
            <span className="pasto-footer__logo">
              {/* eslint-disable-next-line @next/next/no-img-element -- PNG de marca con ancho automático */}
              <img src="/logos/pasto-logo-terracota.png" alt="PASTO" height={44} />
            </span>
            <p className="body-sm">
              Viandas, burritos y complementos hechos en cocina propia. Pedidos con entrega los
              miércoles y, si está habilitado, los viernes.
            </p>
          </div>
          <nav className="pasto-footer__nav" aria-label="Pie de página">
            <Link href="/meal-prep">Meal prep</Link>
            <Link href="/burritos">Burritos</Link>
            <Link href="/cart">Carrito</Link>
            <Link href="/terminos">Términos</Link>
            <Link href="/privacidad">Privacidad</Link>
          </nav>
        </div>
      </footer>
      <BottomNav />
    </>
  );
}
