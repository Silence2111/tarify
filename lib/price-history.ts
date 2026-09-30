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
 * Пометка на карточке: последнее подорожание или снижение за RECENT_DAYS.
 * Изменения приходят новыми сверху (запрос берёт одно последнее).
 */
export function recentPriceChange(
  changes: { kind: string; oldPrice: number | null; newPrice: number | null; createdAt: Date }[] | undefined,
  now: Date = new Date(),
): PriceChangeView | null {
  const c = changes?.[0];
  if (!c || (c.kind !== "UP" && c.kind !== "DOWN")) return null;
  if (c.oldPrice == null || c.newPrice == null) return null;
  if (now.getTime() - c.createdAt.getTime() > RECENT_DAYS * DAY) return null;
  return { kind: c.kind, oldPrice: c.oldPrice, newPrice: c.newPrice, at: c.createdAt.toISOString() };
}

/** Для include в запросах тарифов: последнее повышение или снижение цены. */
export const LATEST_PRICE_CHANGE = {
  where: { kind: { in: ["UP", "DOWN"] as ("UP" | "DOWN")[] } },
  orderBy: { createdAt: "desc" as const },
  take: 1,
  select: { kind: true, oldPrice: true, newPrice: true, createdAt: true },
};

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
  const ups = items.filter((i) => i.kind === "UP" && i.oldPrice && i.newPrice != null);
  const avgUp =
    ups.length > 0
      ? Math.round(
          (ups.reduce((s, i) => s + (i.newPrice! - i.oldPrice!) / i.oldPrice!, 0) / ups.length) *
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

/** Лента изменений цен: новые сверху. Только включённые провайдеры. */
export async function getPriceChanges(opts: {
  types?: readonly PlanType[];
  providerSlug?: string;
  region?: string | null; // цены региона плюс единые по России
  days?: number;
  take?: number;
}): Promise<FeedItem[]> {
  const since = new Date(Date.now() - (opts.days ?? FEED_DAYS) * DAY);
  const rows = await prisma.priceChange.findMany({
    where: {
      createdAt: { gte: since },
      plan: {
        ...(opts.types ? { type: { in: [...opts.types] } } : {}),
        provider: { isActive: true, ...(opts.providerSlug ? { slug: opts.providerSlug } : {}) },
        ...(opts.region !== undefined ? { OR: [{ region: opts.region }, { region: null }] } : {}),
      },
    },
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
