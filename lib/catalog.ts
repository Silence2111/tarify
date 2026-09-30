import { cache } from "react";
import { pickRegion, preferRegional } from "@/lib/catalog-filter";
import { toPlanView } from "@/lib/coverage";
import { prisma } from "@/lib/db";
import { latestPriceChange } from "@/lib/price-history";
import type { CatalogPlan, PlanType } from "@/lib/types";

// Каталоги тарифов без привязки к дому: мобильная связь и счета для бизнеса.
// Показываются только активные тарифы включённых провайдеров, дешёвые сверху.
//
// Чтения обёрнуты в React cache(): метаданные, страница и каталог в одном запросе
// спрашивают одно и то же (регионы, оператора, тарифы) — в базу идёт один запрос.

export function getCatalogPlans(
  type: PlanType,
  opts: { region?: string | null; providerSlug?: string; take?: number } = {},
): Promise<CatalogPlan[]> {
  // cache() сравнивает аргументы по ссылке — объект опций разворачиваем в примитивы.
  return catalogPlans(type, opts.region, opts.providerSlug, opts.take);
}

const catalogPlans = cache(async function catalogPlans(
  type: PlanType,
  region: string | null | undefined,
  providerSlug: string | undefined,
  take: number | undefined,
): Promise<CatalogPlan[]> {
  const plans = await prisma.plan.findMany({
    where: {
      type,
      isActive: true,
      provider: { isActive: true, ...(providerSlug ? { slug: providerSlug } : {}) },
      // Цены выбранного региона плюс тарифы с единой ценой по России.
      ...(region !== undefined ? { OR: [{ region }, { region: null }] } : {}),
    },
    include: {
      options: true,
      provider: { select: { name: true, slug: true } },
      priceChanges: latestPriceChange(),
    },
    orderBy: { priceMonthly: "asc" },
    ...(take ? { take } : {}),
  });
  return preferRegional(
    plans.map((p) => ({
      ...toPlanView(p),
      providerName: p.provider.name,
      providerSlug: p.provider.slug,
    })),
    (p) => p.providerSlug,
  );
});

/** Когда последний раз обновлялись цены каталога (для строки «Цены обновлены …»). */
export const getCatalogUpdatedAt = cache(async function getCatalogUpdatedAt(
  type: PlanType,
  region?: string | null,
  // На странице оператора — свежесть его цен, а не того, кто загрузился последним.
  providerSlug?: string,
): Promise<Date | null> {
  const agg = await prisma.plan.aggregate({
    where: {
      type,
      isActive: true,
      provider: { isActive: true, ...(providerSlug ? { slug: providerSlug } : {}) },
      ...(region !== undefined ? { OR: [{ region }, { region: null }] } : {}),
    },
    _max: { updatedAt: true },
  });
  return agg._max.updatedAt;
});

/** Регионы, для которых загружены цены (тарифы с единой ценой сюда не входят). */
export const getCatalogRegions = cache(async function getCatalogRegions(type: PlanType) {
  const rows = await prisma.plan.findMany({
    where: { type, isActive: true, region: { not: null }, provider: { isActive: true } },
    select: { region: true },
    distinct: ["region"],
    orderBy: { region: "asc" },
  });
  return rows.flatMap((r) => (r.region ? [r.region] : []));
});

/** Операторы (банки), у которых есть активные тарифы этого типа. */
export const getCatalogProviders = cache(async function getCatalogProviders(type: PlanType) {
  return prisma.provider.findMany({
    where: { isActive: true, plans: { some: { type, isActive: true } } },
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });
});

/** Оператор с активными мобильными тарифами; null — страницы оператора нет. */
export const findMobileOperator = cache(function findMobileOperator(slug: string) {
  return prisma.provider.findFirst({
    where: { slug, isActive: true, plans: { some: { type: "MOBILE", isActive: true } } },
    select: { slug: true, name: true },
  });
});

/**
 * Регионы, где у оператора свои цены: слаг оператора → регионы по алфавиту. У
 * виртуальных операторов с единой ценой по России (Т-Мобайл, СберМобайл) их нет —
 * и страниц «оператор + регион» тоже: они были бы копиями друг друга.
 */
export const getMobileOperatorRegions = cache(async function getMobileOperatorRegions() {
  const rows = await prisma.plan.findMany({
    where: { type: "MOBILE", isActive: true, region: { not: null }, provider: { isActive: true } },
    select: { region: true, provider: { select: { slug: true } } },
    distinct: ["providerId", "region"],
    orderBy: { region: "asc" },
  });
  const map = new Map<string, string[]>();
  for (const r of rows) {
    if (!r.region) continue;
    const list = map.get(r.provider.slug);
    if (list) list.push(r.region);
    else map.set(r.provider.slug, [r.region]);
  }
  return map;
});

/** Регионы каталога мобильной связи и регион по умолчанию — он живёт на базовых адресах. */
export const getMobileRegionContext = cache(async function getMobileRegionContext() {
  const regions = await getCatalogRegions("MOBILE");
  return { regions, defaultRegion: pickRegion(undefined, regions) };
});
