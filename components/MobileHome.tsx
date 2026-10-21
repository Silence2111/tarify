import type { Metadata } from "next";
import Link from "next/link";
import {
  getCatalogPlans,
  getCatalogProviders,
  getCatalogUpdatedAt,
  getMobileOperatorRegions,
  getMobileRegionContext,
} from "@/lib/catalog";
import { collectionPlans, MOBILE_COLLECTIONS } from "@/lib/collections";
import { formatDate, plural } from "@/lib/format";
import { catalogPath, operatorPath } from "@/lib/regions";
import { FaqSection, Feature, Step, type FaqItem } from "./HomeBlocks";
import { PlanCard } from "./PlanCard";
import { RegionSelect } from "./RegionSelect";

// Главная, пока искать по адресу нечего (lib/home.ts): запуск с мобильной связи. Её
// не держит покрытие по домам — тарифы операторов видны в любом городе, а оформление
// идёт по партнёрской ссылке на сайте оператора.

const TITLE = "Тарифы — сравнение тарифов мобильной связи по регионам";
const DESCRIPTION =
  "Сравните тарифы операторов мобильной связи с ценами вашего региона: гигабайты, минуты, eSIM. Подбор тарифа под ваш расход — бесплатно.";

export const MOBILE_HOME_METADATA: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  keywords: [
    "тарифы мобильной связи",
    "сравнение тарифов операторов",
    "выгодный тариф для телефона",
    "тарифы с eSIM",
    "подобрать тариф",
  ],
  openGraph: { type: "website", siteName: "Тарифы", locale: "ru_RU", title: TITLE, description: DESCRIPTION },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

const FAQ: FaqItem[] = [
  {
    q: "Почему подбор бесплатный?",
    a: "Операторы платят нам вознаграждение за абонентов, оформивших тариф по нашим ссылкам. Для вас цена та же, что на сайте оператора, без наценки.",
  },
  {
    q: "Откуда цены и насколько они свежие?",
    a: "Из прайсов операторов. Дата обновления указана над списком тарифов, точные условия видно на сайте оператора перед оформлением.",
  },
  {
    q: "Почему у тарифов разные цены в разных регионах?",
    a: "Многие операторы назначают цены по регионам, поэтому сначала выберите свой. Тарифы с единой ценой по России показываются в любом регионе.",
  },
  {
    q: "Можно ли сохранить свой номер?",
    a: "Да: номер переносится к новому оператору, заявку на перенос оформляют у него.",
  },
];

export async function MobileHome() {
  const { regions, defaultRegion } = await getMobileRegionContext();
  const [plans, providers, operatorRegions, updatedAt] = await Promise.all([
    // null — регионов с ценами нет: тарифы с единой ценой по России
    getCatalogPlans("MOBILE", { region: defaultRegion }),
    getCatalogProviders("MOBILE"),
    getMobileOperatorRegions(),
    getCatalogUpdatedAt("MOBILE", defaultRegion),
  ]);
  const regionOptions = regions.map((r) => ({ name: r, href: catalogPath("/mobile", r, defaultRegion) }));
  const collections = MOBILE_COLLECTIONS.filter((c) => collectionPlans(c, plans).length > 0);
  const regionSuffix = defaultRegion ? ` — ${defaultRegion}` : "";

  return (
    <div>
      {/* Hero */}
      <section className="rounded-2xl bg-gradient-to-br from-brand to-brand-dark px-6 py-12 text-white sm:px-10 sm:py-14">
        <h1 className="max-w-2xl text-3xl font-bold leading-tight sm:text-4xl">
          Тарифы мобильной связи: все операторы в одном списке
        </h1>
        <p className="mt-3 max-w-xl text-base text-white/80">
          Сравните гигабайты, минуты и стоимость в вашем регионе. Оформление — на сайте
          оператора, без наценки.
        </p>
        <div className="mt-6 flex flex-col gap-3 rounded-xl bg-white p-4 text-slate-900 shadow-xl sm:flex-row sm:items-center sm:justify-between">
          <RegionSelect options={regionOptions} current={defaultRegion} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/mobile/podbor"
              className="rounded-lg bg-brand px-4 py-2 text-center text-sm font-semibold text-white hover:bg-brand-dark"
            >
              Подобрать под мой расход
            </Link>
            <Link
              href="/mobile"
              className="rounded-lg border border-slate-300 px-4 py-2 text-center text-sm font-semibold text-brand hover:border-brand"
            >
              Все тарифы
            </Link>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-sm text-white/70">
          {providers.length > 0 && (
            <span>
              {providers.length} {plural(providers.length, "оператор", "оператора", "операторов")}
            </span>
          )}
          {regions.length > 0 && (
            <span>
              {regions.length} {plural(regions.length, "регион", "региона", "регионов")} с ценами
            </span>
          )}
          {updatedAt && <span>цены обновлены {formatDate(updatedAt)}</span>}
        </div>
      </section>

      {plans.length > 0 && (
        <section className="mt-10">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-800">
              Самые доступные тарифы{regionSuffix}
            </h2>
            <Link href="/mobile" className="text-sm text-brand hover:underline">
              Все тарифы →
            </Link>
          </div>
          <div className="space-y-3">
            {plans.slice(0, 3).map((p) => (
              <PlanCard key={p.id} plan={p} providerName={p.providerName} addressText="" eyebrow={p.providerName} />
            ))}
          </div>
        </section>
      )}

      {(providers.length > 0 || collections.length > 0) && (
        <section className="mt-8 space-y-3 text-sm">
          {providers.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500">Операторы:</span>
              {providers.map((p) => (
                <Link
                  key={p.slug}
                  href={operatorPath(p.slug, defaultRegion, operatorRegions.get(p.slug) ?? [])}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-brand hover:border-brand"
                >
                  {p.name}
                </Link>
              ))}
            </div>
          )}
          {collections.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500">Подборки:</span>
              {collections.map((c) => (
                <Link
                  key={c.slug}
                  href={`/mobile/podborka/${c.slug}`}
                  className="rounded-full bg-slate-100 px-3 py-1 text-slate-700 hover:bg-slate-200"
                >
                  {c.short}
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Как это работает */}
      <section className="mt-12">
        <h2 className="text-xl font-bold text-slate-900">Как это работает</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Step n="1" title="Выберите регион" text="Цены у операторов в каждом регионе свои — покажем ваши." />
          <Step n="2" title="Сравните тарифы" text="Гигабайты, минуты, SMS и eSIM в одном списке, дешёвые сверху." />
          <Step
            n="3"
            title="Оформите у оператора"
            text="На сайте оператора, по той же цене. SIM-карту или eSIM можно получить без визита в салон."
          />
        </div>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        <Link href="/mobile/podbor" className="rounded-xl border border-slate-200 bg-white p-5 hover:border-brand">
          <div className="font-semibold text-slate-800">Переплачиваете за связь?</div>
          <div className="mt-1 text-sm text-slate-500">
            Укажите свой расход и платёж — подберём тариф дешевле и посчитаем экономию за год.
          </div>
        </Link>
        <Link href="/business" className="rounded-xl border border-slate-200 bg-white p-5 hover:border-brand">
          <div className="font-semibold text-slate-800">Для бизнеса</div>
          <div className="mt-1 text-sm text-slate-500">
            Интернет в офис и расчётные счета: сравнение тарифов и подключение.
          </div>
        </Link>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <Feature title="Честная цена" text="Стоимость тарифа — как у оператора напрямую. Мы не делаем наценку." />
        <Feature title="Цены вашего региона" text="Не средняя цена по стране, а цены там, где вы пользуетесь связью." />
        <Feature title="Все операторы рядом" text="Не нужно обходить сайты операторов: условия и цены — в одном списке." />
      </section>

      <FaqSection items={FAQ} />

      <p className="mt-6 text-xs text-slate-400">
        Цены — по данным операторов на момент загрузки, точные условия — на сайте оператора. Мы
        получаем вознаграждение от операторов за оформление по ссылкам; для вас цена та же.
      </p>
    </div>
  );
}
