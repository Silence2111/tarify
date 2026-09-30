import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import {
  changePercent,
  feedStats,
  priceChangeKind,
  recentPriceChange,
  RECENT_DAYS,
} from "@/lib/price-history";

/**
 * Пометка «подорожал» на карточке и лента изменений — обещание, что цены на сайте
 * живые. Показать подорожание, которого не было, или старое как свежее — хуже,
 * чем не показывать ничего.
 */

const NOW = new Date("2026-09-30T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);

describe("изменение цены", () => {
  it("повышение, снижение, без изменений", () => {
    expect(priceChangeKind(450, 500)).toBe("UP");
    expect(priceChangeKind(500, 450)).toBe("DOWN");
    expect(priceChangeKind(450, 450)).toBeNull();
  });

  it("проценты со знаком", () => {
    expect(changePercent(400, 450)).toBe("+13%");
    expect(changePercent(500, 450)).toBe("−10%");
    expect(changePercent(0, 450)).toBe("");
  });
});

describe("пометка на карточке", () => {
  it("свежее изменение показывается", () => {
    expect(
      recentPriceChange([{ kind: "UP", oldPrice: 400, newPrice: 450, createdAt: daysAgo(10) }], 450, NOW),
    ).toEqual({ kind: "UP", oldPrice: 400, newPrice: 450, at: daysAgo(10).toISOString() });
  });

  it(`старше ${RECENT_DAYS} дней, без цен или не повышение/снижение — нет пометки`, () => {
    expect(
      recentPriceChange(
        [{ kind: "DOWN", oldPrice: 500, newPrice: 450, createdAt: daysAgo(RECENT_DAYS + 1) }],
        450,
        NOW,
      ),
    ).toBeNull();
    expect(
      recentPriceChange([{ kind: "NEW", oldPrice: null, newPrice: 450, createdAt: daysAgo(1) }], 450, NOW),
    ).toBeNull();
    expect(recentPriceChange([], 450, NOW)).toBeNull();
    expect(recentPriceChange(undefined, 450, NOW)).toBeNull();
  });

  it("цена с тех пор другая (сняли и вернули по новой цене) — пометки нет", () => {
    expect(
      recentPriceChange([{ kind: "UP", oldPrice: 500, newPrice: 600, createdAt: daysAgo(10) }], 450, NOW),
    ).toBeNull();
  });
});

describe("сводка ленты", () => {
  it("сколько подорожало и насколько в среднем, сколько подешевело, новых и снятых", () => {
    expect(
      feedStats([
        { kind: "UP", oldPrice: 400, newPrice: 450 }, // +12,5%
        { kind: "UP", oldPrice: 500, newPrice: 550 }, // +10%
        { kind: "DOWN", oldPrice: 700, newPrice: 650 },
        { kind: "NEW", oldPrice: null, newPrice: 900 },
        { kind: "REMOVED", oldPrice: 300, newPrice: null },
      ]),
    ).toEqual({ up: 2, avgUpPercent: 11, down: 1, added: 1, removed: 1 });
  });

  it("без подорожаний средний процент не считается", () => {
    expect(feedStats([]).avgUpPercent).toBeNull();
  });

  it("бесплатный стал платным — подорожание в счёт, но не в средний процент", () => {
    expect(
      feedStats([
        { kind: "UP", oldPrice: 0, newPrice: 490 },
        { kind: "UP", oldPrice: 500, newPrice: 550 },
      ]),
    ).toMatchObject({ up: 2, avgUpPercent: 10 });
  });
});
