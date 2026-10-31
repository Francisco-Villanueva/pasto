import { beforeAll, describe, expect, it } from "vitest";
import { loadCatalogFromDb } from "@/db/catalog";
import type { AppDb } from "@/db/types";
import { productFormSchema, type ProductFormValues } from "@/domain/catalog-admin";
import { listTiers, saveProduct, saveTierPrices, setProductActive } from "./admin-catalog";
import { createTestDb } from "./test-db";

let db: AppDb;

beforeAll(async () => {
  db = await createTestDb();
});

const form = (over: Partial<ProductFormValues> = {}) =>
  productFormSchema.parse({
    id: null,
    name: "Guiso nuevo",
    sku: "guiso-nuevo",
    category: "ESENCIAL",
    description: "",
    ingredients: "lentejas",
    allergens: "",
    netWeightG: "350",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
    imageUrl: "",
    price: "",
    recipeVersion: "v1.0",
    isActive: true,
    ...over,
  });

describe("catálogo del backoffice", () => {
  it("crea un plato que aparece en el catálogo de la tienda", async () => {
    const r = await saveProduct(db, form());
    expect(r.ok).toBe(true);
    const catalog = await loadCatalogFromDb(db);
    expect(catalog.products.find((p) => p.sku === "GUISO-NUEVO")).toMatchObject({
      name: "Guiso nuevo",
      netWeightG: 350,
      isActive: true,
    });
  });

  it("rechaza un código repetido", async () => {
    expect(await saveProduct(db, form())).toMatchObject({ ok: false, code: "SKU_TAKEN" });
  });

  it("edita y desactiva; no deja cambiar la categoría", async () => {
    const catalog = await loadCatalogFromDb(db);
    const id = catalog.products.find((p) => p.sku === "GUISO-NUEVO")!.id;

    expect(
      await saveProduct(db, form({ id, name: "Guiso editado", recipeVersion: "v1.1" })),
    ).toEqual({ ok: true, id });
    expect(await saveProduct(db, form({ id, category: "PROTEICO" }))).toMatchObject({
      ok: false,
      code: "CATEGORY_LOCKED",
    });

    expect(await setProductActive(db, { id, active: false })).toBe(true);
    const after = (await loadCatalogFromDb(db)).products.find((p) => p.id === id)!;
    expect(after).toMatchObject({ name: "Guiso editado", recipeVersion: "v1.1", isActive: false });
  });

  it("un complemento guarda su precio en centavos", async () => {
    await saveProduct(
      db,
      form({ name: "Salsa", sku: "salsa-x", category: "COMPLEMENTO", price: "4.500,50" }),
    );
    const p = (await loadCatalogFromDb(db)).products.find((x) => x.sku === "SALSA-X")!;
    expect(p.priceCents).toBe(450_050);
  });

  it("actualiza el precio de un tramo", async () => {
    const [tier] = await listTiers(db);
    expect(await saveTierPrices(db, [{ id: tier!.id, priceCents: 1_234_500 }])).toBe(true);
    const updated = (await listTiers(db)).find((t) => t.id === tier!.id)!;
    expect(updated.price).toBe("12345.00");
  });
});
