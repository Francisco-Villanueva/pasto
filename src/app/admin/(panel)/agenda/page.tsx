import type { Metadata } from "next";
import { AgendaEditor } from "@/components/admin/AgendaEditor";
import { PageHead } from "@/components/ui";
import { getDb } from "@/db";
import { requireStaff } from "@/server/auth/dal";
import { loadAgenda } from "@/server/admin-agenda";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage() {
  await requireStaff("AGENDA_MANAGE");
  const data = await loadAgenda(await getDb(), new Date());

  return (
    <>
      <PageHead label="AGENDA" title="Agenda">
        Qué días se entrega, en qué franjas y cuánto cuesta el envío.
      </PageHead>
      <AgendaEditor data={data} />
    </>
  );
}
