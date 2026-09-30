// Telegram Bot API: уведомление оператору о новой заявке и посты в канал об изменениях
// цен. Без TELEGRAM_BOT_TOKEN всё выключено. Ошибки не бросаем: уведомление не должно
// ронять приём заявки или загрузку прайса.

/** Экранирование для parse_mode=HTML. */
export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function telegramEnabled(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN);
}

export async function sendTelegram(
  chatId: string,
  html: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return { ok: false, error: "нет TELEGRAM_BOT_TOKEN" };
  // Адрес Bot API можно заменить — например, на прокси, если хостинг не видит Telegram.
  const base = (process.env.TELEGRAM_API_URL || "https://api.telegram.org").replace(/\/$/, "");
  try {
    const res = await fetch(`${base}/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) return { ok: true };
    return { ok: false, error: `HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
