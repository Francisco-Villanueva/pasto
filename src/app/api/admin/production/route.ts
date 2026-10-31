import { getDb } from "@/db";
import { productionToCsv } from "@/domain/production";
import { authorizeApi } from "@/server/auth/dal";
import { loadProductionSheet } from "@/server/production";

/** CSV de producción de una fecha (`?fecha=YYYY-MM-DD`). Sin importes: Cocina también puede pedirlo. */
export async function GET(request: Request) {
  const auth = await authorizeApi("PRODUCTION_VIEW");
  if (!auth.ok) return auth.response;

  const date = new URL(request.url).searchParams.get("fecha") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: { code: "INVALID_DATE" } }, { status: 400 });
  }

  const sheet = await loadProductionSheet(await getDb(), date);
  // BOM para que Excel respete los acentos.
  return new Response(`﻿${productionToCsv(sheet.rows)}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="produccion-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
