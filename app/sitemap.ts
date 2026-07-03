import type { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

// Карта сайта: главная + города + улицы. Это и есть SEO-хвост «провайдеры по адресу».
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const cities = await prisma.city.findMany({
    select: { slug: true, streets: { select: { slug: true } } },
  });

  const urls: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: "weekly", priority: 1 },
  ];
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
