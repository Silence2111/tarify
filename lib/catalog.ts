import { toPlanView } from "@/lib/coverage";
import { prisma } from "@/lib/db";
import { LATEST_PRICE_CHANGE } from "@/lib/price-history";
import type { CatalogPlan, PlanType } from "@/lib/types";

// Каталоги тарифов без привязки к дому: мобильная связь и счета для бизнеса.
// Показываются только активные тарифы включённых провайдеров, дешёвые сверху.

export async function getCatalogPlans(
  type: PlanType,
  opts: { region?: string | null; providerSlug?: string; take?: number } = {},
): Promise<CatalogPlan[]> {
  const plans = await prisma.plan.findMany({
    where: {
      type,
      isActive: true,
      provider: { isActive: true, ...(opts.providerSlug ? { slug: opts.providerSlug } : {}) },
      // Цены выбранного региона плюс тарифы с единой ценой по России.
      ...(opts.region !== undefined ? { OR: [{ region: opts.region }, { region: null }] } : {}),
    },
    include: {
      options: true,
      provider: { select: { name: true, slug: true } },
      priceChanges: LATEST_PRICE_CHANGE,
    },
    orderBy: { priceMonthly: "asc" },
    ...(opts.take ? { take: opts.take } : {}),
  });
  return plans.map((p) => ({
    ...toPlanView(p),
    providerName: p.provider.name,
    providerSlug: p.provider.slug,
  }));
}

/** Когда последний раз обновлялись цены каталога (для строки «Цены обновлены …»). */
export async function getCatalogUpdatedAt(
  type: PlanType,
  region?: string | null,
): Promise<Date | null> {
  const agg = await prisma.plan.aggregate({
    where: {
      type,
      isActive: true,
      provider: { isActive: true },
      ...(region !== undefined ? { OR: [{ region }, { region: null }] } : {}),
    },
    _max: { updatedAt: true },
  });
  return agg._max.updatedAt;
}

/** Регионы, для которых загружены цены (тарифы с единой ценой сюда не входят). */
export async function getCatalogRegions(type: PlanType): Promise<string[]> {
  const rows = await prisma.plan.findMany({
    where: { type, isActive: true, region: { not: null }, provider: { isActive: true } },
    select: { region: true },
    distinct: ["region"],
    orderBy: { region: "asc" },
  });
  return rows.flatMap((r) => (r.region ? [r.region] : []));
}

/** Операторы (банки), у которых есть активные тарифы этого типа. */
export async function getCatalogProviders(type: PlanType) {
  return prisma.provider.findMany({
    where: { isActive: true, plans: { some: { type, isActive: true } } },
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });
}
