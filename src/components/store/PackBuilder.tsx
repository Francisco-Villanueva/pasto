"use client";

import { useMemo, useState } from "react";
import { Button } from "@design/react";
import {
  Counter,
  Modal,
  Notice,
  PageHead,
  Plate,
  Progress,
  Segmented,
  Stat,
  useToast,
} from "@/components/ui";
import { addPack, resolvePlanConflict, type CartPack } from "@/domain/cart";
import { PACK_SIZES, tierKey, type PackCategory } from "@/domain/catalog";
import { sumMacros } from "@/domain/macros";
import { formatMoney } from "@/domain/money";
import {
  activeProducts,
  hasProductInfo,
  toDomainCatalog,
  type StoreCatalog,
  type StoreProduct,
} from "@/domain/store-catalog";
import { useCartReady, useCartStore } from "@/lib/cart-store";
import { DishDetail } from "./DishDetail";
import { CATEGORY_LABEL, packLabel } from "./labels";

type Mode = "meal-prep" | "burritos";

const COPY: Record<Mode, { label: string; title: string; intro: string }> = {
  "meal-prep": {
    label: "MEAL PREP",
    title: "Armá tu pack de meal prep",
    intro:
      "Elegí el plan, el tamaño y repartí las unidades como quieras. El pack se completa cuando la suma da justo el tamaño.",
  },
  burritos: {
    label: "BURRITOS",
    title: "Armá tu pack de burritos",
    intro: "Elegí 6 o 12 y repartí los sabores como quieras. Se completa cuando la suma da justo.",
  },
};

type Conflict = { pack: CartPack; conflictingPackIds: string[] };

export function PackBuilder({ catalog, mode }: { catalog: StoreCatalog; mode: Mode }) {
  const { toast } = useToast();
  const ready = useCartReady();
  const cart = useCartStore((state) => state.cart);
  const setCart = useCartStore((state) => state.setCart);

  const categories: PackCategory[] = mode === "burritos" ? ["BURRITO"] : ["ESENCIAL", "PROTEICO"];
  const [category, setCategory] = useState<PackCategory>(categories[0]!);
  const [size, setSize] = useState<number>(PACK_SIZES[categories[0]!][0]!);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [detail, setDetail] = useState<StoreProduct | null>(null);
  const [conflict, setConflict] = useState<Conflict | null>(null);

  const domainCatalog = useMemo(() => toDomainCatalog(catalog), [catalog]);
  const dishes = activeProducts(catalog, category);
  const macrosById = useMemo(
    () => new Map(catalog.products.map((p) => [p.id, p.macros])),
    [catalog],
  );

  const items = dishes
    .map((dish) => ({ productId: dish.id, quantity: counts[dish.id] ?? 0 }))
    .filter((item) => item.quantity > 0);
  const used = items.reduce((total, item) => total + item.quantity, 0);
  const complete = used === size;
  const price = catalog.tiers.find(
    (t) => tierKey(t.category, t.size) === tierKey(category, size),
  )?.priceCents;
  const macros = sumMacros(items, macrosById);
  const copy = COPY[mode];

  function reset(nextCategory: PackCategory, nextSize: number) {
    setCategory(nextCategory);
    setSize(nextSize);
    setCounts({});
  }

  function add() {
    if (!complete || price === undefined) return;
    const pack: CartPack = { id: crypto.randomUUID(), category, size, items };
    const result = addPack(cart, pack, domainCatalog);

    if (result.status === "added") {
      setCart(result.cart);
      setCounts({});
      toast(`${packLabel(category, size)} agregado al carrito`);
    } else if (result.status === "plan_conflict") {
      // Nunca se pisa el carrito en silencio: el cliente decide.
      setConflict({ pack, conflictingPackIds: result.conflictingPackIds });
    }
  }

  const removed = conflict
    ? cart.packs.filter((pack) => conflict.conflictingPackIds.includes(pack.id))
    : [];
  const existingPlan = removed[0] ? CATEGORY_LABEL[removed[0].category] : "";

  return (
    <>
      <PageHead label={copy.label} title={copy.title}>
        {copy.intro}
      </PageHead>

      <div className="pasto-split">
        <div className="stack-lg">
          <div className="row" style={{ gap: "var(--space-6)", alignItems: "flex-start" }}>
            {categories.length > 1 && (
              <div className="stack" style={{ gap: "var(--space-2)" }}>
                <span className="label">PLAN</span>
                <Segmented
                  label="Plan"
                  value={category}
                  onChange={(value) => reset(value, PACK_SIZES[value][0]!)}
                  options={categories.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
                />
              </div>
            )}
            <div className="stack" style={{ gap: "var(--space-2)" }}>
              <span className="label">TAMAÑO DEL PACK</span>
              <Segmented
                label="Tamaño del pack"
                value={size}
                onChange={(value) => reset(category, value)}
                options={PACK_SIZES[category].map((s) => ({ value: s, label: `${s} unidades` }))}
              />
            </div>
          </div>

          <div className="stack">
            {dishes.length === 0 && (
              <Notice>Por ahora no hay platos disponibles en esta categoría.</Notice>
            )}
            {dishes.map((dish) => {
              const quantity = counts[dish.id] ?? 0;
              return (
                <div key={dish.id} className="pasto-meal">
                  <Plate name={dish.name} small />
                  <div className="stack" style={{ gap: "var(--space-1)" }}>
                    <div className="title">{dish.name}</div>
                    {dish.macros && (
                      <div className="pasto-macros">
                        <span>
                          <b>{dish.macros.calories}</b> kcal
                        </span>
                        <span>
                          <b>{dish.macros.protein}</b> g prot.
                        </span>
                        <span>
                          <b>{dish.macros.carbs}</b> g carb.
                        </span>
                        <span>
                          <b>{dish.macros.fats}</b> g grasa
                        </span>
                      </div>
                    )}
                    {hasProductInfo(dish.allergens) && (
                      <div className="caption muted">Alérgenos: {dish.allergens}</div>
                    )}
                    <button
                      type="button"
                      className="pasto-linklike"
                      onClick={() => setDetail(dish)}
                    >
                      Ver ingredientes y alérgenos
                    </button>
                  </div>
                  <Counter
                    label={dish.name}
                    value={quantity}
                    max={quantity + (size - used)}
                    onChange={(value) => setCounts((current) => ({ ...current, [dish.id]: value }))}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <aside className="pasto-panel pasto-sticky" aria-label="Resumen del pack">
          <span className="label">TU PACK</span>
          <div className="row-between">
            <span className="display-md num">
              {used} de {size}
            </span>
            <span className="title num">
              {price === undefined ? "Sin precio" : formatMoney(price)}
            </span>
          </div>
          <Progress value={used} max={size} label="Avance del pack" />
          <p className="body-sm muted" aria-live="polite">
            {complete
              ? "Pack completo. Podés agregarlo al carrito."
              : `Te faltan ${size - used} para completar el pack.`}
          </p>
          <hr style={{ width: "100%", border: 0, borderTop: "1.5px solid var(--border)" }} />
          <span className="label">TOTAL DE MACROS</span>
          <div className="pasto-macro-grid">
            <Stat label="Calorías" value={macros.calories} />
            <Stat label="Proteína g" value={macros.protein} />
            <Stat label="Carbo g" value={macros.carbs} />
            <Stat label="Grasas g" value={macros.fats} />
          </div>
          <Button disabled={!complete || price === undefined || !ready} onClick={add}>
            Agregar al carrito
          </Button>
          <p className="caption muted">
            Cualquier combinación vale: {size} unidades del mismo plato también es un pack válido.
          </p>
        </aside>
      </div>

      <Modal open={detail !== null} onClose={() => setDetail(null)} title={detail?.name ?? ""}>
        {detail && <DishDetail product={detail} />}
        <div className="row">
          <Button variant="secondary" onClick={() => setDetail(null)}>
            Cerrar
          </Button>
        </div>
      </Modal>

      <Modal
        open={conflict !== null}
        onClose={() => setConflict(null)}
        title={`Tu carrito ya tiene un pack ${existingPlan}`}
      >
        <p className="muted">
          No se pueden combinar planes en el mismo pedido. Elegí si querés conservar lo que ya tenés
          o reemplazar {removed.length > 1 ? "esos packs" : "ese pack"} por el nuevo. Tus burritos y
          complementos se mantienen.
        </p>
        <ul className="pasto-list">
          {removed.map((pack) => (
            <li key={pack.id}>Se quitaría: {packLabel(pack.category, pack.size)}</li>
          ))}
          {conflict && <li>Entraría: {packLabel(conflict.pack.category, conflict.pack.size)}</li>}
        </ul>
        <div className="row">
          <Button
            onClick={() => {
              setConflict(null);
              toast("Mantuvimos tu carrito como estaba");
            }}
          >
            Mantener mi carrito
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (!conflict) return;
              setCart(resolvePlanConflict(cart, conflict.pack, "replace"));
              setCounts({});
              setConflict(null);
              toast(`Carrito actualizado con el pack ${CATEGORY_LABEL[conflict.pack.category]}`);
            }}
          >
            Reemplazar el pack {existingPlan}
          </Button>
        </div>
      </Modal>
    </>
  );
}
