import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MobileCatalog } from "@/components/MobileCatalog";
import { getCatalogPlans, getCatalogRegions } from "@/lib/catalog";
import { pickRegion } from "@/lib/catalog-filter";
import { collectionPlans, findCollection, MIN_INDEXABLE, priceStats } from "@/lib/collections";
import { formatRub, plural } from "@/lib/format";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ region?: string }>;
};

// SEO под запросы «тарифы с безлимитным интернетом», «без абонентской платы» и т. п.
// В описании — свои цифры; подборку с 1–2 тарифами не отдаём в индекс.
export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [{ slug }, { region: requested }] = await Promise.all([params, searchParams]);
  const collection = findCollection(slug);
  if (!collection) return { title: "Подборка не найдена" };

  const region = pickRegion(requested, await getCatalogRegions("MOBILE"));
  const stats = priceStats(collectionPlans(collection, await getCatalogPlans("MOBILE", { region })));
  const where = region ? ` — ${region}` : "";
  return {
    title: `${collection.title}${where}`,
    description: stats
      ? `${stats.count} ${plural(stats.count, "тариф", "тарифа", "тарифов")} от ${formatRub(stats.min)} в месяц${where}. ${collection.description} Сравните и оформите онлайн.`
      : collection.description,
    alternates: { canonical: `/mobile/podborka/${collection.slug}` },
    ...(stats && stats.count >= MIN_INDEXABLE ? {} : { robots: { index: false, follow: true } }),
  };
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const [{ slug }, { region }] = await Promise.all([params, searchParams]);
  const collection = findCollection(slug);
  if (!collection) notFound();
  return <MobileCatalog requestedRegion={region} collection={collection} />;
}
