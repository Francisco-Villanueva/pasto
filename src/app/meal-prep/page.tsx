import type { Metadata } from "next";
import { PublicShell } from "@/components/layout/PublicShell";
import { PackBuilder } from "@/components/store/PackBuilder";
import { loadStoreCatalog } from "@/db/catalog";

export const metadata: Metadata = { title: "Meal prep" };

// El catálogo lo edita el admin: se refresca cada minuto.
export const revalidate = 60;

export default async function MealPrepPage() {
  const catalog = await loadStoreCatalog();
  return (
    <PublicShell>
      <PackBuilder catalog={catalog} mode="meal-prep" />
    </PublicShell>
  );
}
