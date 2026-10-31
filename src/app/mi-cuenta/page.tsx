import type { Metadata } from "next";
import { History } from "lucide-react";
import { Button } from "@design/react";
import { PublicShell } from "@/components/layout/PublicShell";
import { RepeatOrderButton } from "@/components/store/RepeatOrderButton";
import { EmptyState, Notice, OrderStatusBadge, PageHead, Table } from "@/components/ui";
import { getDb } from "@/db";
import { formatMoney } from "@/domain/money";
import { formatDeliveryDay } from "@/domain/schedule";
import { listAccountOrders } from "@/server/account";
import { getCustomer } from "@/server/customer-dal";
import { isCustomerLoginEnabled } from "@/server/google";
import { logoutAction } from "./actions";

export const metadata: Metadata = { title: "Mi cuenta", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function MiCuentaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { error } = await searchParams;
  const account = await getCustomer();

  if (!account) {
    return (
      <PublicShell>
        <PageHead label="MI CUENTA" title="Tus pedidos en un solo lugar">
          Ingresá con Google para ver tus pedidos, repetirlos y contarnos cómo te fue. Si ya pediste
          como invitado con ese mismo email, los vas a encontrar acá.
        </PageHead>
        {error === "google" && (
          <Notice tone="brand" role="alert">
            No pudimos ingresar con Google. Probá de nuevo.
          </Notice>
        )}
        {isCustomerLoginEnabled() ? (
          <div>
            <Button href="/api/cuenta/google">Continuar con Google</Button>
          </div>
        ) : (
          <Notice role="status">El ingreso con Google todavía no está disponible.</Notice>
        )}
      </PublicShell>
    );
  }

  const orders = await listAccountOrders(await getDb(), account.email, new Date());

  return (
    <PublicShell>
      <PageHead
        label="MI CUENTA"
        title={account.fullName ? `Hola, ${account.fullName}` : "Mi cuenta"}
      >
        Ingresaste como {account.email}. Acá están los pedidos hechos con este email.
      </PageHead>

      {orders.length === 0 ? (
        <EmptyState icon={History} title="Todavía no hay pedidos con este email">
          Cuando pidas con {account.email} lo vas a ver acá. Si usaste otro email, el pedido no
          aparece.
        </EmptyState>
      ) : (
        <Table label="Mis pedidos">
          <thead>
            <tr>
              <th scope="col">Pedido</th>
              <th scope="col">Entrega</th>
              <th scope="col">Detalle</th>
              <th scope="col" className="is-num">
                Total
              </th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>{order.orderNumber}</td>
                <td>{formatDeliveryDay(order.scheduledDate)}</td>
                <td>{order.summary.join(", ")}</td>
                <td className="is-num">{formatMoney(order.totalCents)}</td>
                <td>
                  <OrderStatusBadge status={order.status} />
                </td>
                <td>
                  <div className="stack" style={{ gap: "var(--space-2)" }}>
                    <div className="row">
                      <Button small variant="ghost" href={`/pedido/${order.accessToken}`}>
                        Ver pedido
                      </Button>
                      {order.surveyToken && (
                        <Button small variant="ghost" href={`/evaluacion/${order.surveyToken}`}>
                          Calificar platos
                        </Button>
                      )}
                    </div>
                    <RepeatOrderButton orderId={order.id} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <form action={logoutAction}>
        <Button type="submit" variant="ghost">
          Cerrar sesión
        </Button>
      </form>
    </PublicShell>
  );
}
