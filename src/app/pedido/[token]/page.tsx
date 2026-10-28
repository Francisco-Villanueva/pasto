import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb, hasDatabase } from "@/db";
import { PublicShell } from "@/components/layout/PublicShell";
import { OrderSent } from "@/components/store/OrderSent";
import { getOrderConfirmation } from "@/server/order-view";

// Muestra datos del cliente: nunca se indexa ni se guarda en caché.
export const metadata: Metadata = { title: "Pedido", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function PedidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ enviar?: string }>;
}) {
  const [{ token }, { enviar }] = await Promise.all([params, searchParams]);
  if (!hasDatabase()) notFound();

  const order = await getOrderConfirmation(await getDb(), token);
  if (!order) notFound();

  return (
    <PublicShell>
      <OrderSent order={order} autoOpen={enviar === "1"} />
    </PublicShell>
  );
}
