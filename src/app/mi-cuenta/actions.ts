"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db";
import { loadStoreCatalog } from "@/db/catalog";
import type { Cart } from "@/domain/cart";
import { toDomainCatalog } from "@/domain/store-catalog";
import { loadRepeat } from "@/server/account";
import { CUSTOMER_COOKIE, destroyCustomerSession } from "@/server/customer-auth";
import { getCustomer } from "@/server/customer-dal";

export type RepeatActionResult =
  { ok: true; cart: Cart; unavailableNames: string[] } | { ok: false; message: string };

/** Cierra la sesión del cliente y vuelve al inicio. */
export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  await destroyCustomerSession(await getDb(), jar.get(CUSTOMER_COOKIE)?.value);
  jar.delete(CUSTOMER_COOKIE);
  redirect("/");
}

/**
 * "Repetir pedido": devuelve el carrito con las mismas selecciones. Los precios se recalculan con el
 * catálogo vigente y la fecha se pide de nuevo en el checkout; lo discontinuado queda afuera.
 */
export async function repeatOrderAction(orderId: string): Promise<RepeatActionResult> {
  const account = await getCustomer();
  if (!account) return { ok: false, message: "Tu sesión venció. Volvé a ingresar." };
  const id = z.string().uuid().safeParse(orderId);
  if (!id.success) return { ok: false, message: "No encontramos ese pedido." };

  const catalog = toDomainCatalog(await loadStoreCatalog());
  const result = await loadRepeat(await getDb(), {
    email: account.email,
    orderId: id.data,
    catalog,
  });
  if (!result.ok) return { ok: false, message: "No encontramos ese pedido." };
  return { ok: true, cart: result.result.cart, unavailableNames: result.unavailableNames };
}
