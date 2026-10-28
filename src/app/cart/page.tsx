import type { Metadata } from "next";
import { PublicShell } from "@/components/layout/PublicShell";
import { CartView } from "@/components/store/CartView";
import { loadStoreCatalog } from "@/db/catalog";

export const metadata: Metadata = { title: "Carrito" };

export const revalidate = 60;

export default async function CartPage() {
  const catalog = await loadStoreCatalog();
  return (
    <PublicShell>
      <CartView catalog={catalog} />
    </PublicShell>
  );
}
