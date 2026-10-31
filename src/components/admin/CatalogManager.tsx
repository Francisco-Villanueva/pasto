"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Tag } from "@design/react";
import {
  Modal,
  Notice,
  SelectField,
  Switch,
  Table,
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
      <div>
        <Button onClick={() => open(null)}>Nuevo plato</Button>
      </div>

      {error && !editing && (
        <Notice tone="brand" role="alert">
          {error.message}
        </Notice>
      )}

      {PRODUCT_CATEGORIES.map((category) => {
        const rows = products.filter((p) => p.category === category);
        return (
          <section key={category} className="stack" aria-labelledby={`cat-${category}`}>
            <h2 id={`cat-${category}`} className="heading">
              {CATEGORY_LABEL[category]}
            </h2>
            {rows.length === 0 ? (
              <p className="caption">Todavía no hay platos en esta categoría.</p>
            ) : (
              <Table label={CATEGORY_LABEL[category]}>
                <thead>
                  <tr>
                    <th scope="col">Plato</th>
                    <th scope="col">Código</th>
                    <th scope="col">Receta</th>
                    {category === "COMPLEMENTO" && <th scope="col">Precio</th>}
                    <th scope="col">Estado</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td>{p.sku}</td>
                      <td>{p.recipeVersion}</td>
                      {category === "COMPLEMENTO" && <td>{p.priceLabel}</td>}
                      <td>
                        <Tag tone={p.isActive ? "brand" : "outline"}>
                          {p.isActive ? "Activo" : "Inactivo"}
                        </Tag>
                      </td>
                      <td>
                        <div className="row">
                          <Button small variant="secondary" onClick={() => open(p)}>
                            Editar
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
                            {p.isActive ? "Desactivar" : "Activar"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </section>
        );
      })}

      <section className="pasto-panel stack" aria-labelledby="tiers">
        <h2 id="tiers" className="heading">
          Precios de los packs
        </h2>
        <p className="caption">
          Rigen para los pedidos nuevos. Los pedidos ya hechos conservan el precio con el que se
          armaron.
        </p>
        {tiers.map((t) => (
          <TextField
            key={t.id}
            label={t.label}
            inputMode="decimal"
            value={tierPrices[t.id] ?? ""}
            onChange={(e) => setTierPrices({ ...tierPrices, [t.id]: e.target.value })}
          />
        ))}
        {tierError && (
          <Notice tone="brand" role="alert">
            {tierError}
          </Notice>
        )}
        <div>
          <Button
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
            Guardar precios
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
        <TextField
          label="Peso neto (g)"
          inputMode="numeric"
          value={form.netWeightG}
          error={fieldError("netWeightG")}
          onChange={(e) => set("netWeightG", e.target.value)}
        />
        <div className="row">
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
            Guardar plato
          </Button>
          <Button variant="ghost" onClick={() => setEditing(null)}>
            Volver
          </Button>
        </div>
      </Modal>
    </div>
  );
}
