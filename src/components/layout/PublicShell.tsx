import type { ReactNode } from "react";
import { ThemeToggle } from "../ThemeToggle";
import { Logo } from "./Logo";
import { CartNavLink } from "../store/CartNavLink";
import { NavLink } from "./NavLink";

const BEFORE_CART = [
  { href: "/", label: "Inicio" },
  { href: "/meal-prep", label: "Meal prep" },
  { href: "/burritos", label: "Burritos" },
] as const;

/** Estructura de la tienda: cabecera con navegación y tema, contenido y pie. */
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="v-header">
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
      <main className="wrap page">{children}</main>
      <div className="wrap">
        <footer className="pasto-footer">
          <div className="stack">
            <span className="label">PASTO</span>
            <p className="body-sm">
              Viandas, burritos y complementos hechos en cocina propia. Pedidos con entrega los
              miércoles y, si está habilitado, los viernes.
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}
