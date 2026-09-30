// Партнёрские переходы и постбэк CPA-сетей. Чистые функции: их проверяют тесты.

export type ConversionStatus = "PENDING" | "HOLD" | "APPROVED" | "REJECTED";

/**
 * Подставить метку перехода в партнёрскую ссылку. Сети называют её по-разному
 * (subid, sub1, click_id), поэтому место задают в самой ссылке плейсхолдером
 * {subid}. В пути ссылки фигурные скобки хранятся закодированными (%7B…%7D) —
 * так их сохраняет разбор URL при импорте. Без плейсхолдера ссылка не меняется.
 */
export function withSubid(url: string, subid: string): string {
  return url.replace(/\{subid\}|%7Bsubid%7D/gi, encodeURIComponent(subid));
}

// Слова статусов у разных сетей: Pampadu — Approved/Check/Pending/Declined,
// Admitad — approved/pending/declined/approved_but_stalled.
const STATUS_WORDS: Record<ConversionStatus, string[]> = {
  APPROVED: ["approved", "approve", "accepted", "accept", "confirmed", "paid", "success", "одобрено", "оплачено"],
  HOLD: ["hold", "on_hold", "check", "waiting", "approved_but_stalled", "холд"],
  PENDING: ["pending", "new", "created", "processing", "open", "в обработке"],
  REJECTED: ["declined", "decline", "rejected", "reject", "cancelled", "canceled", "cancel", "fail", "failed", "отклонено"],
};

/** Статус из постбэка. Незнакомое слово — «в обработке»: сырой текст хранится рядом. */
export function parseConversionStatus(raw: string): ConversionStatus {
  const s = raw.trim().toLowerCase();
  for (const [status, words] of Object.entries(STATUS_WORDS) as [ConversionStatus, string[]][]) {
    if (words.includes(s)) return status;
  }
  return "PENDING";
}

const FINAL: ReadonlySet<ConversionStatus> = new Set(["APPROVED", "REJECTED"]);

/**
 * Применять ли статус из постбэка. Постбэки доходят не по порядку — сеть повторяет
 * недоставленные, — и поздний «pending» после «approved» спрятал бы заработанное.
 * Поэтому промежуточный статус (в обработке, холд) не перетирает итоговый. Итоговый
 * меняет любой: сеть может отклонить одобренное (фрод) или одобрить после спора.
 */
export function shouldApplyStatus(
  current: ConversionStatus | null,
  incoming: ConversionStatus,
): boolean {
  return !(current != null && FINAL.has(current) && !FINAL.has(incoming));
}

export type LeadStatus = "NEW" | "CALLED" | "CONFIRMED" | "REJECTED";

/**
 * Статус заявки по постбэку сети. Одобрено — подключение подтверждено, за него
 * платят; отклонено — отказ, даже если вручную стояло «Подключено»: деньги решает
 * сеть. Пока сеть работает с заявкой, новая становится «в работе», а закрытую
 * вручную промежуточный статус не трогает.
 */
export function leadStatusFromConversion(
  current: LeadStatus,
  incoming: ConversionStatus,
): LeadStatus {
  if (incoming === "APPROVED") return "CONFIRMED";
  if (incoming === "REJECTED") return "REJECTED";
  return current === "NEW" ? "CALLED" : current;
}

/** Сумма из постбэка: «750», «750.00», «1 234,5» → рубли целым числом; мусор — null. */
export function parsePayout(raw: string | null): number | null {
  if (!raw) return null;
  const s = raw.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  return Math.round(Number(s));
}

/** Поисковые роботы и превью ссылок не должны попадать в статистику переходов. */
export function isBot(userAgent: string | null): boolean {
  if (!userAgent) return true;
  return /bot|crawl|spider|slurp|preview|facebookexternalhit|curl|wget|python|headless/i.test(userAgent);
}

/** Путь страницы, с которой перешли, — только если это наш же сайт. */
export function refererPath(referer: string | null, host: string | null): string | null {
  if (!referer || !host) return null;
  try {
    const u = new URL(referer);
    if (u.host !== host) return null;
    return (u.pathname + u.search).slice(0, 200);
  } catch {
    return null;
  }
}
