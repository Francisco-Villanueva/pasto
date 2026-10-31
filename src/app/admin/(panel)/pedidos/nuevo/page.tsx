import type { Metadata } from "next";
import { OrderEditor } from "@/components/admin/OrderEditor";
import { PageHead } from "@/components/ui";
import { getDb } from "@/db";
import { loadEditorData } from "@/server/admin-data";
import { requireStaff } from "@/server/auth/dal";
import { isMapsEnabled, mapsOptionsFromEnv } from "@/server/maps";

export const metadata: Metadata = { title: "Nuevo pedido" };

export default async function NuevoPedidoPage() {
  await requireStaff("ORDERS_MANAGE");
  const { catalog, days } = await loadEditorData(await getDb(), new Date());

  return (
    <>
      <PageHead label="PEDIDOS" title="Nuevo pedido" />
      <OrderEditor
        mode="create"
        catalog={catalog}
        days={days}
        mapsEnabled={isMapsEnabled(mapsOptionsFromEnv())}
      />
    </>
  );
}
