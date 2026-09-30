import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
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
    { url: `${base}/business`, changeFrequency: "monthly", priority: 0.7 },
  ];
  for (const o of operators) {
    urls.push({ url: `${base}/mobile/${o.slug}`, changeFrequency: "weekly", priority: 0.7 });
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
