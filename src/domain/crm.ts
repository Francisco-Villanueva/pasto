import { addDays, localDate } from "./schedule";

export type CrmTaskType = "D5_CHECKIN" | "D12_SURVEY";

export type CrmTaskDraft = { type: CrmTaskType; scheduledFor: string };

const OFFSETS: Record<CrmTaskType, number> = { D5_CHECKIN: 5, D12_SURVEY: 12 };

/**
 * Tareas de seguimiento al entregar un pedido: D+5 y D+12 contados desde `delivered_at`
 * (en fecha de Buenos Aires) o, si falta, desde la fecha programada.
 * La base impone una sola tarea por `(order_id, type)`, así que repetir el cambio no duplica.
 */
export function buildCrmTasks(order: {
  deliveredAt: Date | null;
  scheduledDate: string;
}): CrmTaskDraft[] {
  const deliveryDate = order.deliveredAt ? localDate(order.deliveredAt) : order.scheduledDate;
  return (Object.keys(OFFSETS) as CrmTaskType[]).map((type) => ({
    type,
    scheduledFor: addDays(deliveryDate, OFFSETS[type]),
  }));
}

export const SURVEY_VALID_DAYS = 60;

/** El link de la encuesta vence a los 60 días de la entrega; antes de entregar no existe. */
export function isSurveyOpen(deliveredAt: Date | null, now: Date): boolean {
  if (!deliveredAt) return false;
  const expiresAt = deliveredAt.getTime() + SURVEY_VALID_DAYS * 86_400_000;
  return now.getTime() < expiresAt;
}
