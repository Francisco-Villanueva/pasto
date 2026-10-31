"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@design/react";
import {
  Apple,
  CircleDollarSign,
  Eye,
  EyeOff,
  Flame,
  Info,
  Pencil,
  Plus,
  Save,
  Search,
  Wheat,
  TriangleAlert,
} from "lucide-react";
import {
  Icon,
  Modal,
  Plate,
  Status,
  Notice,
  SelectField,
  Switch,
  TextareaField,
  TextField,
  useToast,
} from "@/components/ui";
import {
  saveProductAction,
  saveTierPricesAction,
  setProductActiveAction,
  type CatalogActionResult,
} from "@/app/admin/(panel)/catalogo/actions";
import {
  CATEGORY_LABEL,
  PRODUCT_CATEGORIES,
  recipeVersionWarning,
  type ProductFormValues,
} from "@/domain/catalog-admin";
import { hasProductInfo } from "@/domain/store-catalog";

export type CatalogProduct = {
  id: string;
  sku: string;
  name: string;
  category: (typeof PRODUCT_CATEGORIES)[number];
  description: string;
  ingredients: string;
  allergens: string;
  netWeightG: number | null;
  macros: { calories: number; protein: number; carbs: number; fats: number } | null;
  imageUrl: string | null;
  /** Ya formateado para el campo: "4500" o "4500,50". */
  price: string;
  priceLabel: string;
  recipeVersion: string;
  isActive: boolean;
};

export type CatalogTier = { id: string; label: string; price: string };

const EMPTY: ProductFormValues = {
  id: null,
  name: "",
  sku: "",
  category: "ESENCIAL",
  description: "",
  ingredients: "",
  allergens: "",
  netWeightG: "",
  calories: "",
  protein: "",
  carbs: "",
  fats: "",
  imageUrl: "",
  price: "",
  recipeVersion: "v1.0",
  isActive: true,
};

function toForm(p: CatalogProduct): ProductFormValues {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category,
    description: p.description,
    ingredients: p.ingredients,
    allergens: p.allergens,
    netWeightG: p.netWeightG === null ? "" : String(p.netWeightG),
    calories: p.macros ? String(p.macros.calories) : "",
    protein: p.macros ? String(p.macros.protein) : "",
    carbs: p.macros ? String(p.macros.carbs) : "",
    fats: p.macros ? String(p.macros.fats) : "",
    imageUrl: p.imageUrl ?? "",
    price: p.price,
    recipeVersion: p.recipeVersion,
    isActive: p.isActive,
  };
}

export function CatalogManager({
  products,
  tiers,
}: {
  products: CatalogProduct[];
  tiers: CatalogTier[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState<{ original: CatalogProduct | null } | null>(null);
  const [form, setForm] = useState<ProductFormValues>(EMPTY);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);
  const [tierPrices, setTierPrices] = useState<Record<string, string>>(
    Object.fromEntries(tiers.map((t) => [t.id, t.price])),
  );
  const [tierError, setTierError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"TODOS" | (typeof PRODUCT_CATEGORIES)[number]>("TODOS");
  const [query, setQuery] = useState("");

  function run(action: () => Promise<CatalogActionResult>, done: string, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        toast(done);
        after?.();
        router.refresh();
      } else setError({ message: result.message, field: result.field });
    });
  }

  function open(original: CatalogProduct | null) {
    setError(null);
    setForm(original ? toForm(original) : EMPTY);
    setEditing({ original });
  }

  const set = <K extends keyof ProductFormValues>(key: K, value: ProductFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const fieldError = (name: string) => (error?.field === name ? error.message : undefined);

  const original = editing?.original ?? null;
  const warning = original
    ? recipeVersionWarning(original, {
        ingredients: form.ingredients,
        description: form.description,
        recipeVersion: form.recipeVersion,
      })
    : null;

  return (
    <div className="stack">
      {error && !editing && (
        <Notice tone="brand" role="alert">
          {error.message}
        </Notice>
      )}

      <div className="pasto-filterbar">
        <label className="pasto-search">
          <Icon icon={Search} />
          <span className="sr-only">Buscar plato</span>
          <input
            className="pasto-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre o código del plato"
          />
        </label>
        <Button onClick={() => open(null)}>
          <Icon icon={Plus} /> Nuevo plato
        </Button>
      </div>

      <div className="pasto-chips" role="group" aria-label="Filtrar por categoría">
        {(["TODOS", ...PRODUCT_CATEGORIES] as const).map((c) => {
          const count =
            c === "TODOS" ? products.length : products.filter((p) => p.category === c).length;
          return (
            <button
              key={c}
              type="button"
              className="pasto-chip"
              aria-pressed={filter === c}
              onClick={() => setFilter(c)}
            >
              {c === "TODOS" ? "Todos" : CATEGORY_LABEL[c]}
              <span className="pasto-chip__count num">{count}</span>
            </button>
          );
        })}
      </div>

      {PRODUCT_CATEGORIES.filter((c) => filter === "TODOS" || filter === c).map((category) => {
        const needle = query.trim().toLowerCase();
        const rows = products.filter(
          (p) =>
            p.category === category &&
            (needle === "" ||
              p.name.toLowerCase().includes(needle) ||
              p.sku.toLowerCase().includes(needle)),
        );
        return (
          <section key={category} className="stack" aria-labelledby={`cat-${category}`}>
            <h2 id={`cat-${category}`} className="heading">
              {CATEGORY_LABEL[category]}
            </h2>
            {rows.length === 0 ? (
              <p className="caption">
                {needle
                  ? "Ningún plato coincide con la búsqueda."
                  : "Todavía no hay platos en esta categoría."}
              </p>
            ) : (
              <ul className="pasto-products">
                {rows.map((p) => {
                  const incomplete = !hasProductInfo(p.ingredients) || !hasProductInfo(p.allergens);
                  return (
                    <li
                      key={p.id}
                      className={p.isActive ? "pasto-product" : "pasto-product is-off"}
                    >
                      <div className="pasto-product__top">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- link externo cargado por el equipo
                          <img className="pasto-product__img" src={p.imageUrl} alt="" />
                        ) : (
                          <Plate name={p.name} small />
                        )}
                        <div className="pasto-product__title">
                          <b>{p.name}</b>
                          <span className="caption muted">
                            {p.sku} · Receta {p.recipeVersion}
                          </span>
                          <Status
                            tone={p.isActive ? "verde" : "hollow"}
                            tag={p.isActive ? "brand" : "outline"}
                          >
                            {p.isActive ? "Activo" : "Inactivo"}
                          </Status>
                        </div>
                      </div>
                      <ul className="pasto-product__facts caption">
                        {category === "COMPLEMENTO" && (
                          <li>
                            <Icon icon={CircleDollarSign} size={14} /> {p.priceLabel}
                          </li>
                        )}
                        {p.macros && (
                          <li>
                            <Icon icon={Flame} size={14} /> {p.macros.calories} kcal ·{" "}
                            {p.macros.protein} g prot.
                          </li>
                        )}
                        {incomplete && (
                          <li className="pasto-product__warn">
                            <Icon icon={TriangleAlert} size={14} /> Faltan ingredientes o alérgenos
                          </li>
                        )}
                      </ul>
                      <div className="row">
                        <Button small variant="secondary" onClick={() => open(p)}>
                          <Icon icon={Pencil} size={16} /> Editar
                        </Button>
                        <Button
                          small
                          variant="ghost"
                          disabled={pending}
                          onClick={() =>
                            run(
                              () => setProductActiveAction({ id: p.id, active: !p.isActive }),
                              p.isActive ? "Plato desactivado" : "Plato activado",
                            )
                          }
                        >
                          <Icon icon={p.isActive ? EyeOff : Eye} size={16} />{" "}
                          {p.isActive ? "Desactivar" : "Activar"}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <section className="pasto-panel stack" aria-labelledby="tiers">
        <h2 id="tiers" className="heading pasto-h-icon">
          <Icon icon={CircleDollarSign} size={22} /> Precios de los packs
        </h2>
        <p className="caption">
          Rigen para los pedidos nuevos. Los pedidos ya hechos conservan el precio con el que se
          armaron.
        </p>
        <div className="pasto-tierprices">
          {tiers.map((t) => (
            <TextField
              key={t.id}
              label={t.label}
              inputMode="decimal"
              value={tierPrices[t.id] ?? ""}
              onChange={(e) => setTierPrices({ ...tierPrices, [t.id]: e.target.value })}
            />
          ))}
        </div>
        {tierError && (
          <Notice tone="brand" role="alert">
            {tierError}
          </Notice>
        )}
        <div>
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              setTierError(null);
              startTransition(async () => {
                const result = await saveTierPricesAction(
                  tiers.map((t) => ({ id: t.id, price: tierPrices[t.id] ?? "" })),
                );
                if (result.ok) {
                  toast("Precios guardados");
                  router.refresh();
                } else setTierError(result.message);
              });
            }}
          >
            <Icon icon={Save} /> Guardar precios
          </Button>
        </div>
      </section>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={original ? `Editar ${original.name}` : "Nuevo plato"}
      >
        <TextField
          label="Nombre"
          value={form.name}
          error={fieldError("name")}
          onChange={(e) => set("name", e.target.value)}
        />
        <TextField
          label="Código"
          hint="Único, sin espacios. Por ejemplo GUISO-LENTEJAS."
          value={form.sku}
          error={fieldError("sku")}
          onChange={(e) => set("sku", e.target.value)}
        />
        <SelectField
          label="Categoría"
          value={form.category}
          disabled={original !== null}
          hint={original ? "No se puede cambiar después de crear el plato." : undefined}
          onChange={(e) => set("category", e.target.value as ProductFormValues["category"])}
        >
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </SelectField>
        {form.category === "COMPLEMENTO" && (
          <TextField
            label="Precio del pack"
            inputMode="decimal"
            hint="En pesos. Por ejemplo 4500 o 4500,50."
            value={form.price}
            error={fieldError("price")}
            onChange={(e) => set("price", e.target.value)}
          />
        )}
        <h3 className="pasto-formsec">
          <Icon icon={Wheat} size={18} /> Qué es el plato
        </h3>
        <TextareaField
          label="Descripción"
          rows={3}
          value={form.description}
          error={fieldError("description")}
          onChange={(e) => set("description", e.target.value)}
        />
        <TextareaField
          label="Ingredientes"
          rows={3}
          value={form.ingredients}
          error={fieldError("ingredients")}
          onChange={(e) => set("ingredients", e.target.value)}
        />
        <TextField
          label="Alérgenos"
          hint="Si lo dejás vacío, la tienda pide consultar."
          value={form.allergens}
          error={fieldError("allergens")}
          onChange={(e) => set("allergens", e.target.value)}
        />
        <h3 className="pasto-formsec">
          <Icon icon={Apple} size={18} /> Valores nutricionales
        </h3>
        <TextField
          label="Peso neto (g)"
          inputMode="numeric"
          value={form.netWeightG}
          error={fieldError("netWeightG")}
          onChange={(e) => set("netWeightG", e.target.value)}
        />
        <div className="pasto-fields-2">
          <TextField
            label="Calorías"
            inputMode="numeric"
            value={form.calories}
            error={fieldError("calories")}
            onChange={(e) => set("calories", e.target.value)}
          />
          <TextField
            label="Proteínas (g)"
            inputMode="numeric"
            value={form.protein}
            onChange={(e) => set("protein", e.target.value)}
          />
          <TextField
            label="Carbohidratos (g)"
            inputMode="numeric"
            value={form.carbs}
            onChange={(e) => set("carbs", e.target.value)}
          />
          <TextField
            label="Grasas (g)"
            inputMode="numeric"
            value={form.fats}
            onChange={(e) => set("fats", e.target.value)}
          />
        </div>
        <h3 className="pasto-formsec">
          <Icon icon={Info} size={18} /> Publicación
        </h3>
        <TextField
          label="Link de la imagen"
          type="url"
          hint="Opcional. Un link https a la foto del plato."
          value={form.imageUrl}
          error={fieldError("imageUrl")}
          onChange={(e) => set("imageUrl", e.target.value)}
        />
        <TextField
          label="Versión de receta"
          hint="Subila (v1.1, v2.0) cuando cambie la receta: las encuestas arrancan de cero."
          value={form.recipeVersion}
          error={fieldError("recipeVersion")}
          onChange={(e) => set("recipeVersion", e.target.value)}
        />
        {warning && <Notice role="status">{warning}</Notice>}
        <Switch
          label="Activo (se puede pedir)"
          checked={form.isActive}
          onChange={(e) => set("isActive", e.target.checked)}
        />
        {error && !error.field && (
          <Notice tone="brand" role="alert">
            {error.message}
          </Notice>
        )}
        <div className="row">
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () => saveProductAction(form),
                "Plato guardado",
                () => setEditing(null),
              )
            }
          >
            <Icon icon={Save} /> Guardar plato
          </Button>
          <Button variant="ghost" onClick={() => setEditing(null)}>
            Volver
          </Button>
        </div>
      </Modal>
    </div>
  );
}
