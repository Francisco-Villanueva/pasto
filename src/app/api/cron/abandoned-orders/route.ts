import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/db";
import { cancelAbandonedOrders } from "@/server/abandonment";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Sin secreto configurado la ruta queda cerrada: nunca abierta por defecto.
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** La llama Vercel Cron una vez por hora (ver `vercel.json`). */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  }
  const cancelled = await cancelAbandonedOrders(await getDb(), new Date());
  return Response.json({ cancelled });
}
