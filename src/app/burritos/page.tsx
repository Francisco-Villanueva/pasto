import type { Metadata } from "next";
import { PublicShell } from "@/components/layout/PublicShell";
import { PackBuilder } from "@/components/store/PackBuilder";
import { loadStoreCatalog } from "@/db/catalog";

export const metadata: Metadata = { title: "Burritos" };

export const revalidate = 60;

export default async function BurritosPage() {
  const catalog = await loadStoreCatalog();
  return (
    <PublicShell>
      <PackBuilder catalog={catalog} mode="burritos" />
    </PublicShell>
  );
}
