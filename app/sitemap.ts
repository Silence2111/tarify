import type { MetadataRoute } from "next";
import { getCatalogPlans, getMobileOperatorRegions, getMobileRegionContext } from "@/lib/catalog";
import { pickRegion } from "@/lib/catalog-filter";
import { collectionPlans, MIN_INDEXABLE, MOBILE_COLLECTIONS } from "@/lib/collections";
import { prisma } from "@/lib/db";
import { FEED_MIN_INDEXABLE, getPriceChanges } from "@/lib/price-history";
import { regionSlug } from "@/lib/regions";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

// Карта сайта: главная + города + улицы — SEO-хвост «провайдеры по адресу»;
// плюс каталог мобильной связи с операторами и раздел для бизнеса.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const [cities, operators] = await Promise.all([
    prisma.city.findMany({
      select: { slug: true, streets: { select: { slug: true } } },
    }),
    prisma.provider.findMany({
      where: { isActive: true, plans: { some: { type: "MOBILE", isActive: true } } },
      select: { slug: true },
    }),
  ]);

  const urls: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/mobile`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/mobile/podbor`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/business`, changeFrequency: "monthly", priority: 0.7 },
  ];
  // Мобильная связь по регионам. Регион по умолчанию живёт на базовых адресах
  // (/mobile, /mobile/<оператор>, /mobile/podborka/<подборка>), остальные — с регионом
  // в пути. Оператору — только регионы, где у него свои цены.
  const [{ regions, defaultRegion }, operatorRegions, mobilePlans] = await Promise.all([
    getMobileRegionContext(),
    getMobileOperatorRegions(),
    getCatalogPlans("MOBILE"),
  ]);
  const otherRegions = regions.filter((r) => r !== defaultRegion);
  for (const r of otherRegions) {
    urls.push({ url: `${base}/mobile/${regionSlug(r)}`, changeFrequency: "weekly", priority: 0.8 });
  }
  for (const o of operators) {
    urls.push({ url: `${base}/mobile/${o.slug}`, changeFrequency: "weekly", priority: 0.7 });
    const own = operatorRegions.get(o.slug) ?? [];
    const ownDefault = pickRegion(undefined, own);
    for (const r of own.filter((x) => x !== ownDefault)) {
      urls.push({
        url: `${base}/mobile/${o.slug}/${regionSlug(r)}`,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  }
  // Подборки — только те, что индексируются (3+ тарифа в регионе).
  const plansIn = (r: string | null) => mobilePlans.filter((p) => p.region === null || p.region === r);
  for (const c of MOBILE_COLLECTIONS) {
    if (collectionPlans(c, plansIn(defaultRegion)).length >= MIN_INDEXABLE) {
      urls.push({ url: `${base}/mobile/podborka/${c.slug}`, changeFrequency: "weekly", priority: 0.6 });
    }
    for (const r of otherRegions) {
      if (collectionPlans(c, plansIn(r)).length >= MIN_INDEXABLE) {
        urls.push({
          url: `${base}/mobile/podborka/${c.slug}/${regionSlug(r)}`,
          changeFrequency: "weekly",
          priority: 0.5,
        });
      }
    }
  }
  // Лента изменений цен — как и подборки, только непустая (иначе она noindex).
  if ((await getPriceChanges({ take: FEED_MIN_INDEXABLE })).length >= FEED_MIN_INDEXABLE) {
    urls.push({ url: `${base}/izmeneniya-cen`, changeFrequency: "daily", priority: 0.6 });
  }
  for (const c of cities) {
    urls.push({ url: `${base}/${c.slug}`, changeFrequency: "weekly", priority: 0.8 });
    for (const s of c.streets) {
      urls.push({
        url: `${base}/${c.slug}/${s.slug}`,
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  }
  return urls;
}
