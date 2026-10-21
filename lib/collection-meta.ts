import type { Metadata } from "next";
import { getCatalogPlans } from "@/lib/catalog";
import {
  collectionPlans,
  MIN_INDEXABLE,
  operatorCollectionIndexable,
  priceStats,
  withOperator,
  type Collection,
} from "@/lib/collections";
import { formatRub, plural } from "@/lib/format";

/**
 * Метаданные подборки в регионе — для /mobile/podborka/<подборка>[/<регион>] и, с
 * оператором, для /mobile/<оператор>/podborka/<подборка>[/<регион>]. В описании — свои
 * цифры; подборку с 1–2 тарифами не отдаём в индекс, а подборку оператора — ещё и когда
 * в неё попали все его тарифы (lib/collections.ts).
 */
export async function collectionMetadata(
  collection: Collection,
  region: string | null,
  canonical: string,
  operator?: { slug: string; name: string },
): Promise<Metadata> {
  const all = await getCatalogPlans("MOBILE", { region, providerSlug: operator?.slug });
  const plans = collectionPlans(collection, all);
  const stats = priceStats(plans);
  const where = region ? ` — ${region}` : "";
  const indexable = operator
    ? operatorCollectionIndexable(plans.length, all.length)
    : plans.length >= MIN_INDEXABLE;
  return {
    title: `${operator ? withOperator(collection.title, operator.name) : collection.title}${where}`,
    description: stats
      ? `${stats.count} ${plural(stats.count, "тариф", "тарифа", "тарифов")}${operator ? ` ${operator.name}` : ""} от ${formatRub(stats.min)} в месяц${where}. ${collection.description} Сравните и оформите онлайн.`
      : collection.description,
    alternates: { canonical },
    ...(indexable ? {} : { robots: { index: false, follow: true } }),
  };
}
