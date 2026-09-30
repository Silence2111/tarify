import { prisma } from "@/lib/db";
import type { PlanType, PriceChangeView } from "@/lib/types";

// История цен тарифов: лента изменений и пометки на карточках. Изменения пишет
// импорт прайса (lib/plans-import.ts); здесь — чтение и чистые функции для страниц.

export type PriceChangeKind = "NEW" | "UP" | "DOWN" | "REMOVED";

/** Сколько дней карточка тарифа помнит, что он подорожал или подешевел. */
export const RECENT_DAYS = 60;
/** За сколько дней лента показывает изменения. */
export const FEED_DAYS = 90;
/** Меньше этого — лента не индексируется: пустая страница вредит сайту. */
export const FEED_MIN_INDEXABLE = 3;

const DAY = 24 * 60 * 60 * 1000;

/** Изменение цены действующего тарифа — повышение или снижение. */
export function priceChangeKind(oldPrice: number, newPrice: number): "UP" | "DOWN" | null {
  if (newPrice > oldPrice) return "UP";
  if (newPrice < oldPrice) return "DOWN";
  return null;
}

/**
 * Пометка на карточке: последнее изменение, если это подорожание или снижение за
 * RECENT_DAYS и цена с тех пор та же. Тариф сняли и вернули по другой цене (NEW) —
 * старое «подорожал» уже не про эту цену, пометки нет.
 */
export function recentPriceChange(
  changes: { kind: string; oldPrice: number | null; newPrice: number | null; createdAt: Date }[] | undefined,
  currentPrice: number,
  now: Date = new Date(),
): PriceChangeView | null {
  const c = changes?.[0];
  if (!c || (c.kind !== "UP" && c.kind !== "DOWN")) return null;
  if (c.oldPrice == null || c.newPrice == null || c.newPrice !== currentPrice) return null;
  if (now.getTime() - c.createdAt.getTime() > RECENT_DAYS * DAY) return null;
  return { kind: c.kind, oldPrice: c.oldPrice, newPrice: c.newPrice, at: c.createdAt.toISOString() };
}

/**
 * Для include в запросах тарифов: одно последнее изменение за RECENT_DAYS. Окно — в
 * запросе, а не после: иначе с каждой загрузкой прайса страницы тянули бы всю историю.
 */
export function latestPriceChange() {
  return {
    where: {
      kind: { in: ["UP", "DOWN", "NEW"] as ("UP" | "DOWN" | "NEW")[] },
      createdAt: { gte: new Date(Date.now() - RECENT_DAYS * DAY) },
    },
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { kind: true, oldPrice: true, newPrice: true, createdAt: true },
  };
}

/** «+12%» / «−8%»: на сколько изменилась цена. */
export function changePercent(oldPrice: number, newPrice: number): string {
  if (oldPrice <= 0) return "";
  const pct = Math.round(((newPrice - oldPrice) / oldPrice) * 100);
  return pct > 0 ? `+${pct}%` : pct < 0 ? `−${Math.abs(pct)}%` : "0%";
}

export type FeedItem = {
  id: string;
  kind: PriceChangeKind;
  oldPrice: number | null;
  newPrice: number | null;
  createdAt: Date;
  planName: string;
  planType: PlanType;
  region: string | null;
  providerName: string;
  providerSlug: string;
};

/** Сводка ленты: сколько подорожало и насколько в среднем, сколько подешевело. */
export function feedStats(items: Pick<FeedItem, "kind" | "oldPrice" | "newPrice">[]) {
  const ups = items.filter((i) => i.kind === "UP");
  // Средний процент — только там, где было от чего считать: с 0 ₽ процента нет.
  const withBase = ups.filter((i) => i.oldPrice && i.newPrice != null);
  const avgUp =
    withBase.length > 0
      ? Math.round(
          (withBase.reduce((s, i) => s + (i.newPrice! - i.oldPrice!) / i.oldPrice!, 0) /
            withBase.length) *
            100,
        )
      : null;
  return {
    up: ups.length,
    avgUpPercent: avgUp,
    down: items.filter((i) => i.kind === "DOWN").length,
    added: items.filter((i) => i.kind === "NEW").length,
    removed: items.filter((i) => i.kind === "REMOVED").length,
  };
}

type FeedQuery = {
  types?: readonly PlanType[];
  providerSlug?: string;
  region?: string | null; // цены региона плюс единые по России
  days?: number;
};

function feedWhere(opts: FeedQuery) {
  return {
    createdAt: { gte: new Date(Date.now() - (opts.days ?? FEED_DAYS) * DAY) },
    plan: {
      ...(opts.types ? { type: { in: [...opts.types] } } : {}),
      provider: { isActive: true, ...(opts.providerSlug ? { slug: opts.providerSlug } : {}) },
      ...(opts.region !== undefined ? { OR: [{ region: opts.region }, { region: null }] } : {}),
    },
  };
}

/**
 * Сводка за весь период — по всем изменениям, а не по показанной странице ленты:
 * подорожание у крупного оператора — это сотни строк по регионам.
 */
export async function getPriceChangeStats(opts: FeedQuery) {
  const rows = await prisma.priceChange.findMany({
    where: feedWhere(opts),
    select: { kind: true, oldPrice: true, newPrice: true },
  });
  return feedStats(rows);
}

/** Лента изменений цен: новые сверху. Только включённые провайдеры. */
export async function getPriceChanges(opts: FeedQuery & { take?: number }): Promise<FeedItem[]> {
  const rows = await prisma.priceChange.findMany({
    where: feedWhere(opts),
    include: {
      plan: {
        select: {
          name: true,
          type: true,
          region: true,
          provider: { select: { name: true, slug: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    ...(opts.take ? { take: opts.take } : {}),
  });
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    oldPrice: r.oldPrice,
    newPrice: r.newPrice,
    createdAt: r.createdAt,
    planName: r.plan.name,
    planType: r.plan.type,
    region: r.plan.region,
    providerName: r.plan.provider.name,
    providerSlug: r.plan.provider.slug,
  }));
}
