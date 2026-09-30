// Что оператор меняет в заявке из админки: статус и/или заметку. Заметка — для
// себя («не дозвонился, перезвонить в 18:00»): в сеть и в выгрузку CSV она не уходит.

export const LEAD_STATUSES = ["NEW", "CALLED", "CONFIRMED", "REJECTED"] as const;
export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

export const COMMENT_MAX = 1000;

export type LeadUpdate = { status?: LeadStatusValue; comment?: string | null };

/** Разобрать тело PATCH: пустая заметка — удалить её, длинная — обрезать. */
export function parseLeadUpdate(body: unknown): { data: LeadUpdate } | { error: string } {
  const { status, comment } = (body ?? {}) as Record<string, unknown>;
  const data: LeadUpdate = {};
  if (status !== undefined) {
    if (typeof status !== "string" || !LEAD_STATUSES.includes(status as LeadStatusValue)) {
      return { error: "Недопустимый статус" };
    }
    data.status = status as LeadStatusValue;
  }
  if (comment !== undefined) {
    if (typeof comment !== "string") return { error: "Заметка должна быть строкой" };
    data.comment = comment.trim().slice(0, COMMENT_MAX) || null;
  }
  if (Object.keys(data).length === 0) return { error: "Нечего менять: нужен status или comment" };
  return { data };
}
