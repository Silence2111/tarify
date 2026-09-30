import Link from "next/link";
import {
  getCatalogPlans,
  getCatalogProviders,
  getCatalogRegions,
  getCatalogUpdatedAt,
} from "@/lib/catalog";
import { pickRegion } from "@/lib/catalog-filter";
import { collectionPlans, MOBILE_COLLECTIONS, priceStats, type Collection } from "@/lib/collections";
import { formatDate, formatRub, plural } from "@/lib/format";
import { CatalogList } from "./CatalogList";
import { RegionSelect } from "./RegionSelect";

// Страница каталога мобильной связи: вся, по одному оператору или SEO-подборка.
// Регион — из ?region=, иначе Москва; тарифы с единой ценой по России видны в
// любом регионе.
export async function MobileCatalog({
  requestedRegion,
  operator,
  collection,
}: {
  requestedRegion?: string;
  operator?: { slug: string; name: string };
  collection?: Collection;
}) {
  const regions = await getCatalogRegions("MOBILE");
  const region = pickRegion(requestedRegion, regions);
  const [regionPlans, providers, updatedAt] = await Promise.all([
    getCatalogPlans("MOBILE", { region, providerSlug: operator?.slug }),
    getCatalogProviders("MOBILE"),
    getCatalogUpdatedAt("MOBILE", region),
  ]);
  const plans = collection ? collectionPlans(collection, regionPlans) : regionPlans;
  const stats = collection ? priceStats(plans) : null;
  // В фильтре «Оператор» — только те, чьи тарифы есть в списке.
  const listProviders = operator
    ? []
    : [...new Map(plans.map((p) => [p.providerSlug, { slug: p.providerSlug, name: p.providerName }])).values()]
        .sort((a, b) => a.name.localeCompare(b.name, "ru"));
  // Ссылки на подборки, в которых в этом регионе что-то есть.
  const collections = operator
    ? []
    : MOBILE_COLLECTIONS.filter(
        (c) => c.slug !== collection?.slug && collectionPlans(c, regionPlans).length > 0,
      );
  const basePath = operator
    ? `/mobile/${operator.slug}`
    : collection
      ? `/mobile/podborka/${collection.slug}`
      : "/mobile";
  const regionQuery = region ? `?region=${encodeURIComponent(region)}` : "";
  const heading = operator
    ? `Тарифы ${operator.name}`
    : collection
      ? collection.title
      : "Тарифы мобильной связи";

  return (
    <div>
      <div className="mb-4 text-sm text-slate-500">
        <Link href="/" className="hover:text-brand">
          Главная
        </Link>{" "}
        /{" "}
        {operator || collection ? (
          <>
            <Link href={`/mobile${regionQuery}`} className="hover:text-brand">
              Мобильная связь
            </Link>{" "}
            / {operator?.name ?? collection?.short}
          </>
        ) : (
          "Мобильная связь"
        )}
      </div>

      <h1 className="text-2xl font-bold text-slate-900">
        {heading}
        {region ? ` — ${region}` : ""}
      </h1>
      <p className="mt-1 max-w-2xl text-slate-500">
        {collection
          ? collection.description
          : "Сравните гигабайты, минуты и цену. Оформление — на сайте оператора, SIM-карту или eSIM можно получить без визита в салон. Сохранить свой номер можно при любом тарифе."}
      </p>
      {stats && (
        <p className="mt-1 text-sm text-slate-600">
          {stats.count} {plural(stats.count, "тариф", "тарифа", "тарифов")} от {formatRub(stats.min)},
          средняя цена — {formatRub(stats.median)} в месяц
        </p>
      )}
      {updatedAt && (
        <p className="mt-1 text-sm text-slate-400">Цены обновлены {formatDate(updatedAt)}</p>
      )}
      {regionPlans.length > 0 && (
        <Link
          href={`/mobile/podbor${regionQuery}`}
          className="mt-3 inline-block rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 hover:border-green-400"
        >
          Переплачиваете за связь? <span className="font-semibold">Подберите тариф под свой расход →</span>
        </Link>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <RegionSelect regions={regions} current={region} basePath={basePath} />
        {!operator && !collection && providers.length > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            {providers.map((p) => (
              <Link
                key={p.slug}
                href={`/mobile/${p.slug}${regionQuery}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-brand hover:border-brand"
              >
                {p.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      {collections.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">Подборки:</span>
          {collections.map((c) => (
            <Link
              key={c.slug}
              href={`/mobile/podborka/${c.slug}${regionQuery}`}
              className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200"
            >
              {c.short}
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6">
        {plans.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
            {collection
              ? "В этом регионе таких тарифов пока нет. Посмотрите другой регион или все тарифы."
              : "Тарифов пока нет. Они появятся, когда в админке загрузят прайс операторов."}
          </div>
        ) : (
          <CatalogList plans={plans} kind="mobile" providers={listProviders} />
        )}
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Цены — по данным операторов на момент загрузки, точные условия — на сайте оператора. Мы
        получаем вознаграждение от операторов за оформление по ссылкам; для вас цена та же.
      </p>
    </div>
  );
}
