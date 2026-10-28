"use client";

import { useMemo } from "react";
import { ShoppingBasket } from "lucide-react";
import { Button } from "@design/react";
import { EmptyState, Counter, Notice, PageHead, Panel, useToast } from "@/components/ui";
import { addComplement, cartIssues, removeComplement, removePack } from "@/domain/cart";
import { formatMoney } from "@/domain/money";
import { priceCart } from "@/domain/pricing";
import {
  activeProducts,
  toDomainCatalog,
  toPriceTable,
  type StoreCatalog,
} from "@/domain/store-catalog";
import { useCartReady, useCartStore } from "@/lib/cart-store";
import { packLabel } from "./labels";

export function CartView({ catalog }: { catalog: StoreCatalog }) {
  const { toast } = useToast();
  const ready = useCartReady();
  const cart = useCartStore((state) => state.cart);
  const setCart = useCartStore((state) => state.setCart);

  const domainCatalog = useMemo(() => toDomainCatalog(catalog), [catalog]);
  const prices = useMemo(() => toPriceTable(catalog), [catalog]);
  const names = useMemo(() => new Map(catalog.products.map((p) => [p.id, p.name])), [catalog]);

  if (!ready) {
    return (
      <>
        <PageHead label="CARRITO" title="Tu carrito" />
        <p className="muted" role="status">
          Cargando tu carrito…
        </p>
      </>
    );
  }

  const issues = cartIssues(cart, domainCatalog);
  const priced = priceCart(cart, prices, domainCatalog);
  const orphan = issues.some((i) => i.code === "ORPHAN_COMPLEMENTS");
  const blocked = issues.length > 0 || !priced.ok;
  const empty = cart.packs.length === 0 && cart.complements.length === 0;
  const lineByPack = new Map(
    priced.ok
      ? priced.lines.flatMap((line) => (line.kind === "PACK" ? [[line.packId, line] as const] : []))
      : [],
  );

  const complementProducts = activeProducts(catalog, "COMPLEMENTO");
  const unavailable = cart.complements.filter(
    (c) => !complementProducts.some((p) => p.id === c.productId),
  );

  function changeComplement(productId: string, quantity: number, next: number) {
    if (next < quantity) {
      setCart(removeComplement(cart, productId, quantity - next));
      return;
    }
    const result = addComplement(cart, productId, domainCatalog, next - quantity);
    if (result.status === "added") {
      setCart(result.cart);
    } else if (result.reason === "NO_MAIN_PACK") {
      // El aviso fijo ya explica el bloqueo; el toast solo responde al clic.
      toast("Sumá primero un pack de meal prep o de burritos");
    } else {
      toast("Ese complemento ya no está disponible");
    }
  }

  if (empty) {
    return (
      <>
        <PageHead label="CARRITO" title="Tu carrito" />
        <EmptyState
          icon={ShoppingBasket}
          title="Tu carrito está vacío"
          action={{ label: "Armar meal prep", href: "/meal-prep" }}
        >
          Armá un pack de meal prep o de burritos para empezar.
        </EmptyState>
      </>
    );
  }

  return (
    <>
      <PageHead label="CARRITO" title="Tu carrito" />
      <div className="pasto-split">
        <div className="stack-lg">
          <section className="stack" aria-label="Packs">
            <span className="label">PACKS</span>
            {cart.packs.length === 0 && (
              <Panel>
                <p className="title">No tenés packs en el carrito</p>
                <div className="row">
                  <Button href="/meal-prep" variant="secondary" small>
                    Armar meal prep
                  </Button>
                  <Button href="/burritos" variant="secondary" small>
                    Armar burritos
                  </Button>
                </div>
              </Panel>
            )}
            {cart.packs.map((pack) => {
              const line = lineByPack.get(pack.id);
              const packIssues = issues.filter(
                (i) => i.code === "PACK_ISSUE" && i.packId === pack.id,
              );
              return (
                <Panel key={pack.id}>
                  <div className="row-between">
                    <span className="title">{packLabel(pack.category, pack.size)}</span>
                    <span className="title num">{line ? formatMoney(line.totalCents) : "—"}</span>
                  </div>
                  <ul className="pasto-list">
                    {pack.items.map((item) => (
                      <li key={item.productId}>
                        {item.quantity}x {names.get(item.productId) ?? "Plato que ya no existe"}
                      </li>
                    ))}
                  </ul>
                  {packIssues.length > 0 && (
                    <Notice tone="brand" role="alert">
                      <strong>Este pack ya no se puede pedir tal cual.</strong> Algún plato dejó de
                      estar disponible o el pack no suma sus unidades. Quitalo y armalo de nuevo.
                    </Notice>
                  )}
                  <div className="row">
                    <Button
                      variant="ghost"
                      small
                      onClick={() => {
                        setCart(removePack(cart, pack.id));
                        toast("Pack quitado");
                      }}
                    >
                      Quitar pack
                    </Button>
                  </div>
                </Panel>
              );
            })}
            <Notice>
              No se pueden mezclar los planes <strong>Esencial</strong> y <strong>Proteico</strong>{" "}
              en un mismo pedido. Los burritos y complementos van con cualquiera.
            </Notice>
          </section>

          {orphan && (
            <Notice tone="brand" role="alert">
              <span>
                <strong>Falta un pack principal.</strong> Los complementos no se pueden comprar
                solos. Agregá un pack de meal prep o de burritos, o quitá los complementos para
                seguir.
              </span>
            </Notice>
          )}

          <section className="stack" aria-label="Complementos">
            <span className="label">SUMÁ UN COMPLEMENTO</span>
            {complementProducts.map((product) => {
              const quantity =
                cart.complements.find((c) => c.productId === product.id)?.quantity ?? 0;
              return (
                <div
                  key={product.id}
                  className="pasto-meal"
                  style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}
                >
                  <div className="stack" style={{ gap: 2 }}>
                    <div className="title">{product.name}</div>
                    <div className="body-sm muted">
                      Pack{product.netWeightG ? ` de ${product.netWeightG} g` : ""}
                      {product.priceCents !== undefined && ` · ${formatMoney(product.priceCents)}`}
                    </div>
                  </div>
                  <Counter
                    label={product.name}
                    value={quantity}
                    onChange={(next) => changeComplement(product.id, quantity, next)}
                  />
                </div>
              );
            })}
            {unavailable.map((complement) => (
              <div
                key={complement.productId}
                className="pasto-meal"
                style={{ gridTemplateColumns: "minmax(0,1fr) auto" }}
              >
                <div className="stack" style={{ gap: 2 }}>
                  <div className="title">{names.get(complement.productId) ?? "Complemento"}</div>
                  <div className="body-sm muted">Ya no está disponible. Quitalo para seguir.</div>
                </div>
                <Button
                  variant="ghost"
                  small
                  onClick={() =>
                    setCart(removeComplement(cart, complement.productId, complement.quantity))
                  }
                >
                  Quitar
                </Button>
              </div>
            ))}
          </section>
        </div>

        <aside className="pasto-panel pasto-sticky" aria-label="Resumen">
          <span className="label">RESUMEN</span>
          <div className="pasto-line">
            <span>Subtotal</span>
            <span className="num">{priced.ok ? formatMoney(priced.subtotalCents) : "—"}</span>
          </div>
          <div className="pasto-line muted">
            <span>Envío</span>
            <span className="body-sm">Se calcula en el checkout</span>
          </div>
          <hr style={{ width: "100%", border: 0, borderTop: "1.5px solid var(--border)" }} />
          <Button
            href="/checkout"
            aria-disabled={blocked}
            onClick={(event) => {
              if (blocked) event.preventDefault();
            }}
          >
            Continuar al checkout
          </Button>
          <p className="caption muted">
            Cada pack se cobra a su precio. Dos packs de 10 no pasan a precio de pack de 20.
          </p>
        </aside>
      </div>
    </>
  );
}
