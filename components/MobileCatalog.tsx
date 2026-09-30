import Link from "next/link";
import {
  getCatalogPlans,
  getCatalogProviders,
  getCatalogRegions,
  getCatalogUpdatedAt,
  getMobileOperatorRegions,
} from "@/lib/catalog";
import { pickRegion } from "@/lib/catalog-filter";
import { collectionPlans, MOBILE_COLLECTIONS, priceStats, type Collection } from "@/lib/collections";
import { formatDate, formatRub, plural } from "@/lib/format";
import { getPriceChanges } from "@/lib/price-history";
import { catalogPath, operatorPath } from "@/lib/regions";
import { CatalogList } from "./CatalogList";
import { PriceChangeList } from "./PriceChangeList";
import { RegionSelect } from "./RegionSelect";

// Страница каталога мобильной связи: вся, по одному оператору или SEO-подборка — в
// регионе, который страница уже определила по адресу. Тарифы с единой ценой по России
// видны в любом регионе. Ссылки на регионы, операторов и подборки ведут на адреса с
// регионом в пути (lib/regions.ts).
export async function MobileCatalog({
  region,
  operator,
  collection,
}: {
  region: string | null;
  operator?: { slug: string; name: string };
  collection?: Collection;
}) {
  const [globalRegions, operatorRegions] = await Promise.all([
    getCatalogRegions("MOBILE"),
    getMobileOperatorRegions(),
  ]);
  const globalDefault = pickRegion(undefined, globalRegions);
  // Регионы этой страницы: у оператора — только те, где у него свои цены.
  const ownRegions = operator ? (operatorRegions.get(operator.slug) ?? []) : globalRegions;
  const ownDefault = pickRegion(undefined, ownRegions);
  // Регион для ссылок на общий каталог и подборки — если там есть такой регион.
  const catalogRegion = region && globalRegions.includes(region) ? region : null;

  const [regionPlans, providers, updatedAt, operatorChanges] = await Promise.all([
    getCatalogPlans("MOBILE", { region, providerSlug: operator?.slug }),
    getCatalogProviders("MOBILE"),
    getCatalogUpdatedAt("MOBILE", region, operator?.slug),
    // На странице оператора — его изменения цен за год: «МТС повысил цены» ищут часто.
    operator
      ? getPriceChanges({ types: ["MOBILE"], providerSlug: operator.slug, region, days: 365, take: 5 })
      : Promise.resolve([]),
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
  const regionOptions = ownRegions.map((r) => ({ name: r, href: catalogPath(basePath, r, ownDefault) }));
  const mobileHome = catalogPath("/mobile", catalogRegion, globalDefault);
  const regionQuery = region ? `?region=${encodeURIComponent(region)}` : "";
  // Страница региона всего каталога: /mobile/tatarstan.
  const regionPage = !operator && !collection && region !== globalDefault;
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
        {operator || collection || regionPage ? (
          <>
            <Link href={operator || collection ? mobileHome : "/mobile"} className="hover:text-brand">
              Мобильная связь
            </Link>{" "}
            / {operator?.name ?? collection?.short ?? region}
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
        <p className="mt-1 text-sm text-slate-400">
          Цены обновлены {formatDate(updatedAt)} ·{" "}
          <Link href="/izmeneniya-cen?type=mobile" className="hover:text-brand hover:underline">
            история изменений цен
          </Link>
        </p>
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
        <RegionSelect options={regionOptions} current={region} />
        {!operator && !collection && providers.length > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            {providers.map((p) => (
              <Link
                key={p.slug}
                href={operatorPath(p.slug, region, operatorRegions.get(p.slug) ?? [])}
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
              href={catalogPath(`/mobile/podborka/${c.slug}`, catalogRegion, globalDefault)}
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

      {operator && operatorChanges.length > 0 && (
        <section className="mt-8">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-800">Изменения цен {operator.name}</h2>
            <Link href="/izmeneniya-cen?type=mobile" className="text-sm text-brand hover:underline">
              Все изменения цен →
            </Link>
          </div>
          <PriceChangeList items={operatorChanges} />
        </section>
      )}

      <p className="mt-6 text-xs text-slate-400">
        Цены — по данным операторов на момент загрузки, точные условия — на сайте оператора. Мы
        получаем вознаграждение от операторов за оформление по ссылкам; для вас цена та же.
      </p>
    </div>
  );
}
