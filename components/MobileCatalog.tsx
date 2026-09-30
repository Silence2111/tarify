import Link from "next/link";
import {
  getCatalogPlans,
  getCatalogProviders,
  getCatalogRegions,
  getCatalogUpdatedAt,
} from "@/lib/catalog";
import { pickRegion } from "@/lib/catalog-filter";
import { formatDate } from "@/lib/format";
import { CatalogList } from "./CatalogList";
import { RegionSelect } from "./RegionSelect";

// Страница каталога мобильной связи: вся или по одному оператору. Регион — из
// ?region=, иначе Москва; тарифы с единой ценой по России видны в любом регионе.
export async function MobileCatalog({
  requestedRegion,
  operator,
}: {
  requestedRegion?: string;
  operator?: { slug: string; name: string };
}) {
  const regions = await getCatalogRegions("MOBILE");
  const region = pickRegion(requestedRegion, regions);
  const [plans, providers, updatedAt] = await Promise.all([
    getCatalogPlans("MOBILE", { region, providerSlug: operator?.slug }),
    getCatalogProviders("MOBILE"),
    getCatalogUpdatedAt("MOBILE", region),
  ]);
  const basePath = operator ? `/mobile/${operator.slug}` : "/mobile";

  return (
    <div>
      <div className="mb-4 text-sm text-slate-500">
        <Link href="/" className="hover:text-brand">
          Главная
        </Link>{" "}
        /{" "}
        {operator ? (
          <>
            <Link href="/mobile" className="hover:text-brand">
              Мобильная связь
            </Link>{" "}
            / {operator.name}
          </>
        ) : (
          "Мобильная связь"
        )}
      </div>

      <h1 className="text-2xl font-bold text-slate-900">
        {operator ? `Тарифы ${operator.name}` : "Тарифы мобильной связи"}
        {region ? ` — ${region}` : ""}
      </h1>
      <p className="mt-1 max-w-2xl text-slate-500">
        Сравните гигабайты, минуты и цену. Оформление — на сайте оператора, SIM-карту или eSIM
        можно получить без визита в салон. Сохранить свой номер можно при любом тарифе.
      </p>
      {updatedAt && (
        <p className="mt-1 text-sm text-slate-400">Цены обновлены {formatDate(updatedAt)}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <RegionSelect regions={regions} current={region} basePath={basePath} />
        {!operator && providers.length > 0 && (
          <div className="flex flex-wrap gap-2 text-sm">
            {providers.map((p) => (
              <Link
                key={p.slug}
                href={`/mobile/${p.slug}${region ? `?region=${encodeURIComponent(region)}` : ""}`}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-brand hover:border-brand"
              >
                {p.name}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        {plans.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-slate-500">
            Тарифов пока нет. Они появятся, когда в админке загрузят прайс операторов.
          </div>
        ) : (
          <CatalogList plans={plans} kind="mobile" providers={operator ? [] : providers} />
        )}
      </div>

      <p className="mt-6 text-xs text-slate-400">
        Цены — по данным операторов на момент загрузки, точные условия — на сайте оператора. Мы
        получаем вознаграждение от операторов за оформление по ссылкам; для вас цена та же.
      </p>
    </div>
  );
}
