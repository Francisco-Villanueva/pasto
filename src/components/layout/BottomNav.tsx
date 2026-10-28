"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Sandwich,
  ShoppingCart,
  User,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { Icon } from "@/components/ui";
import { cartCount } from "@/lib/cart-persistence";
import { useCartReady, useCartStore } from "@/lib/cart-store";

type Item = { href: string; label: string; icon: LucideIcon };

const LEFT: Item[] = [
  { href: "/", label: "Inicio", icon: House },
  { href: "/meal-prep", label: "Meal prep", icon: UtensilsCrossed },
];
const RIGHT: Item[] = [
  { href: "/burritos", label: "Burritos", icon: Sandwich },
  { href: "/mi-cuenta", label: "Mi cuenta", icon: User },
];

/**
 * Navegación inferior del celular. No aparece en el inicio (ahí manda la portada) ni en pantallas
 * anchas, donde sigue la navegación de la cabecera. El botón central es el carrito con su cantidad.
 */
export function BottomNav() {
  const pathname = usePathname();
  const ready = useCartReady();
  const count = useCartStore((state) => cartCount(state.cart));

  if (pathname === "/") return null;

  const isCurrent = (href: string) => (href === "/" ? false : pathname.startsWith(href));
  const cartActive = isCurrent("/cart");
  const showCount = ready && count > 0;

  const renderItem = (item: Item) => (
    <li key={item.href}>
      <Link
        href={item.href}
        className="pasto-bottomnav__item"
        aria-current={isCurrent(item.href) ? "page" : undefined}
      >
        <Icon icon={item.icon} size={24} />
        {item.label}
      </Link>
    </li>
  );

  return (
    <nav className="pasto-bottomnav" aria-label="Navegación inferior">
      <ul>
        {LEFT.map(renderItem)}
        <li className="pasto-bottomnav__center">
          <Link
            href="/cart"
            className="pasto-bottomnav__cart"
            aria-current={cartActive ? "page" : undefined}
            aria-label={
              showCount ? `Carrito, ${count} ${count === 1 ? "producto" : "productos"}` : "Carrito"
            }
          >
            <Icon icon={ShoppingCart} size={26} />
            {showCount && (
              <span key={count} className="pasto-bottomnav__badge" aria-hidden="true">
                {count}
              </span>
            )}
          </Link>
          <span className="pasto-bottomnav__cart-label" aria-hidden="true">
            Carrito
          </span>
        </li>
        {RIGHT.map(renderItem)}
      </ul>
    </nav>
  );
}
