import type { Metadata } from "next";
import { CatalogManager } from "@/components/admin/CatalogManager";
import { PageHead } from "@/components/ui";
import { loadCatalogFromDb } from "@/db/catalog";
import { getDb } from "@/db";
import { pesosField } from "@/domain/catalog-admin";
import { centsFromNumeric, formatMoney } from "@/domain/money";
import { requireStaff } from "@/server/auth/dal";
import { listTiers } from "@/server/admin-catalog";

export const metadata: Metadata = { title: "Catálogo" };

const PACK_LABEL = { ESENCIAL: "Esenciales", PROTEICO: "Proteicos", BURRITO: "Burritos" } as const;

export default async function CatalogoPage() {
  await requireStaff("CATALOG_MANAGE");
  const db = await getDb();
  const [catalog, tiers] = await Promise.all([loadCatalogFromDb(db), listTiers(db)]);

  return (
    <>
      <PageHead label="CATÁLOGO" title="Catálogo">
        Platos, ingredientes, alérgenos, valores nutricionales, versión de receta y precios. Los
        platos no se borran: se desactivan.
      </PageHead>
      <CatalogManager
        products={catalog.products.map((p) => ({
          id: p.id,
          sku: p.sku,
          name: p.name,
          category: p.category,
          description: p.description,
          ingredients: p.ingredients,
          allergens: p.allergens,
          netWeightG: p.netWeightG,
          macros: p.macros,
          imageUrl: p.imageUrl,
          price: pesosField(p.priceCents),
          priceLabel: p.priceCents === undefined ? "-" : formatMoney(p.priceCents),
          recipeVersion: p.recipeVersion,
          isActive: p.isActive,
        }))}
        tiers={tiers.map((t) => ({
          id: t.id,
          label: `${PACK_LABEL[t.category as keyof typeof PACK_LABEL]} de ${t.size}`,
          price: pesosField(centsFromNumeric(t.price)),
        }))}
      />
    </>
  );
}
