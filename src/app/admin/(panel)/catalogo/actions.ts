"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getDb } from "@/db";
import { parseTierPrices, productFormSchema } from "@/domain/catalog-admin";
import { authorizeAction } from "@/server/auth/dal";
import { saveProduct, saveTierPrices, setProductActive } from "@/server/admin-catalog";

export type CatalogActionResult = { ok: true } | { ok: false; message: string; field?: string };

/** El catálogo se lee en la tienda y en el armado de packs: se refrescan todas las páginas. */
function refresh() {
  revalidatePath("/", "layout");
}

export async function saveProductAction(raw: unknown): Promise<CatalogActionResult> {
  const auth = await authorizeAction("CATALOG_MANAGE");
  if (!auth.ok) return auth;

  const parsed = productFormSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0]!;
    return { ok: false, message: issue.message, field: String(issue.path[0] ?? "") };
  }

  const result = await saveProduct(await getDb(), parsed.data);
  if (!result.ok) return { ok: false, message: result.message };
  refresh();
  return { ok: true };
}

export async function setProductActiveAction(input: {
  id: string;
  active: boolean;
}): Promise<CatalogActionResult> {
  const auth = await authorizeAction("CATALOG_MANAGE");
  if (!auth.ok) return auth;
  const id = z.string().uuid().safeParse(input.id);
  if (!id.success) return { ok: false, message: "No encontramos ese plato." };

  const found = await setProductActive(await getDb(), {
    id: id.data,
    active: input.active === true,
  });
  if (!found) return { ok: false, message: "No encontramos ese plato." };
  refresh();
  return { ok: true };
}

export async function saveTierPricesAction(
  entries: { id: string; price: string }[],
): Promise<CatalogActionResult> {
  const auth = await authorizeAction("CATALOG_MANAGE");
  if (!auth.ok) return auth;

  const shape = z
    .array(z.object({ id: z.string().uuid(), price: z.string().max(20) }))
    .max(50)
    .safeParse(entries);
  if (!shape.success) return { ok: false, message: "Los datos no son válidos." };

  const parsed = parseTierPrices(shape.data);
  if (!parsed.ok) return { ok: false, message: parsed.message };

  const all = await saveTierPrices(await getDb(), parsed.tiers);
  if (!all) return { ok: false, message: "Algún tramo ya no existe. Recargá la página." };
  refresh();
  return { ok: true };
}
