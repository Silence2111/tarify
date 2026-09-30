import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import type { ImportedPriceChange } from "@/lib/plans-import";
import { priceChangesPost } from "@/lib/price-post";

/**
 * Пост в канал уходит без проверки человеком: неверная цена или «подорожал» вместо
 * «подешевел» сразу видны подписчикам. Партнёрских ссылок в посте быть не должно —
 * это была бы реклама без маркировки.
 */

const change = (c: Partial<ImportedPriceChange>): ImportedPriceChange => ({
  provider: "МТС",
  plan: "Базовый 20",
  region: "Москва",
  kind: "UP",
  oldPrice: 450,
  newPrice: 470,
  ...c,
});

const NOW = new Date("2026-09-30T09:00:00Z");

describe("пост об изменениях цен", () => {
  it("по оператору и региону, со словами и процентами, ссылка — только на ленту сайта", () => {
    const post = priceChangesPost(
      [
        change({}),
        change({ plan: "Оптимальный 40", kind: "DOWN", oldPrice: 700, newPrice: 650 }),
        change({ plan: "Новый 60", kind: "NEW", oldPrice: null, newPrice: 900 }),
        change({ plan: "Безлимитный", kind: "REMOVED", oldPrice: 1100, newPrice: null }),
        change({ provider: "Т-Мобайл", plan: "Безлимитный", region: null, oldPrice: 990, newPrice: 1090 }),
      ],
      "https://tarify.ru",
      NOW,
    )!.replace(/ /g, " ");

    expect(post).toBe(
      [
        "<b>Изменения цен · 30 сентября 2026</b>",
        "<b>МТС · Москва</b>\n" +
          "«Базовый 20» подорожал: 450 ₽ → 470 ₽ (+4%)\n" +
          "«Оптимальный 40» подешевел: 700 ₽ → 650 ₽ (−7%)\n" +
          "«Новый 60» — новый тариф, 900 ₽\n" +
          "«Безлимитный» снят с продажи",
        "<b>Т-Мобайл · вся Россия</b>\n«Безлимитный» подорожал: 990 ₽ → 1 090 ₽ (+10%)",
        "Все изменения цен: https://tarify.ru/izmeneniya-cen",
      ].join("\n\n"),
    );
  });

  it("с 0 ₽ — без процентов и без пустых скобок", () => {
    const post = priceChangesPost(
      [change({ provider: "Т-Банк", plan: "Старт", region: null, oldPrice: 0, newPrice: 490 })],
      "https://tarify.ru",
      NOW,
    )!.replace(/\u00a0/g, " ");
    expect(post).toContain("«Старт» подорожал: 0 ₽ → 490 ₽\n");
    expect(post).not.toContain("()");
  });

  it("нет изменений — нет поста", () => {
    expect(priceChangesPost([], "https://tarify.ru", NOW)).toBeNull();
  });

  it("длинный прайс обрезается, чтобы пост влез в Telegram; названия экранируются", () => {
    const many = Array.from({ length: 45 }, (_, i) => change({ plan: `Тариф <${i}>` }));
    const post = priceChangesPost(many, "https://tarify.ru", NOW)!;
    expect(post).toContain("…и ещё 15");
    expect(post).toContain("«Тариф &lt;0&gt;»");
    expect(post.length).toBeLessThan(4096);
  });
});
