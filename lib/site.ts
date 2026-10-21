// Базовый URL сайта для канонических ссылок, sitemap и robots.
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Демо-режим: данные примерные. Выключается NEXT_PUBLIC_DEMO=0, когда залиты реальные.
 * Пока включён — плашка, noindex на весь сайт (next.config.mjs), заявки не принимаются.
 */
export function isDemo(): boolean {
  return process.env.NEXT_PUBLIC_DEMO !== "0";
}
