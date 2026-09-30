import { formatDay, formatRub } from "@/lib/format";
import type { ImportedPriceChange } from "@/lib/plans-import";
import { changePercent } from "@/lib/price-history";
import { escapeHtml } from "@/lib/telegram";

// Пост в Telegram-канал после загрузки прайса: что подорожало, подешевело, появилось и
// снято. Подорожание у оператора — повод искать тариф, а канал возвращает людей на сайт.
// В посте только ссылка на ленту сайта, без партнёрских ссылок: иначе это реклама
// оператора, которую нужно маркировать (erid).

const MAX_LINES = 30; // Telegram режет сообщения длиннее 4096 символов

function line(c: ImportedPriceChange): string {
  const plan = `«${escapeHtml(c.plan)}»`;
  switch (c.kind) {
    case "UP":
    case "DOWN":
      return `${plan} ${c.kind === "UP" ? "подорожал" : "подешевел"}: ${formatRub(c.oldPrice ?? 0)} → ${formatRub(
        c.newPrice ?? 0,
      )} (${changePercent(c.oldPrice ?? 0, c.newPrice ?? 0)})`;
    case "NEW":
      return `${plan} — новый тариф, ${formatRub(c.newPrice ?? 0)}`;
    case "REMOVED":
      return `${plan} снят с продажи`;
  }
}

/** Текст поста (HTML для Telegram); null — если изменений нет. */
export function priceChangesPost(
  changes: ImportedPriceChange[],
  site: string,
  now: Date = new Date(),
): string | null {
  if (changes.length === 0) return null;

  // По оператору и региону — в порядке прайса.
  const groups = new Map<string, ImportedPriceChange[]>();
  for (const c of changes) {
    const key = `${c.provider} · ${c.region ?? "вся Россия"}`;
    const list = groups.get(key);
    if (list) list.push(c);
    else groups.set(key, [c]);
  }

  const parts = [`<b>Изменения цен · ${formatDay(now)}</b>`];
  let shown = 0;
  for (const [title, list] of groups) {
    if (shown >= MAX_LINES) break;
    const lines = list.slice(0, MAX_LINES - shown).map(line);
    shown += lines.length;
    parts.push(`<b>${escapeHtml(title)}</b>\n${lines.join("\n")}`);
  }
  if (changes.length > shown) parts.push(`…и ещё ${changes.length - shown}`);
  parts.push(`Все изменения цен: ${site}/izmeneniya-cen`);
  return parts.join("\n\n");
}
