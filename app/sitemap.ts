import type { MetadataRoute } from "next";
import { getCatalogPlans, getCatalogRegions } from "@/lib/catalog";
import { pickRegion } from "@/lib/catalog-filter";
import { collectionPlans, MIN_INDEXABLE, MOBILE_COLLECTIONS } from "@/lib/collections";
import { prisma } from "@/lib/db";
import { FEED_MIN_INDEXABLE, getPriceChanges } from "@/lib/price-history";
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
  for (const o of operators) {
    urls.push({ url: `${base}/mobile/${o.slug}`, changeFrequency: "weekly", priority: 0.7 });
  }
  // Подборки — только те, что индексируются в регионе по умолчанию (адрес без ?region=).
  const defaultRegion = pickRegion(undefined, await getCatalogRegions("MOBILE"));
  const mobilePlans = await getCatalogPlans("MOBILE", { region: defaultRegion });
  for (const c of MOBILE_COLLECTIONS) {
    if (collectionPlans(c, mobilePlans).length >= MIN_INDEXABLE) {
      urls.push({ url: `${base}/mobile/podborka/${c.slug}`, changeFrequency: "weekly", priority: 0.6 });
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
