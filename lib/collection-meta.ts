import type { Metadata } from "next";
import { getCatalogPlans } from "@/lib/catalog";
import { collectionPlans, MIN_INDEXABLE, priceStats, type Collection } from "@/lib/collections";
import { formatRub, plural } from "@/lib/format";

/**
 * Метаданные подборки в регионе — и для /mobile/podborka/<подборка>, и для
 * /mobile/podborka/<подборка>/<регион>. В описании — свои цифры; подборку с 1–2
 * тарифами не отдаём в индекс.
 */
export async function collectionMetadata(
  collection: Collection,
  region: string | null,
  canonical: string,
): Promise<Metadata> {
  const stats = priceStats(collectionPlans(collection, await getCatalogPlans("MOBILE", { region })));
  const where = region ? ` — ${region}` : "";
  return {
    title: `${collection.title}${where}`,
    description: stats
      ? `${stats.count} ${plural(stats.count, "тариф", "тарифа", "тарифов")} от ${formatRub(stats.min)} в месяц${where}. ${collection.description} Сравните и оформите онлайн.`
      : collection.description,
    alternates: { canonical },
    ...(stats && stats.count >= MIN_INDEXABLE ? {} : { robots: { index: false, follow: true } }),
  };
}
