import { UNLIMITED, type CatalogPlan } from "@/lib/types";

// SEO-подборки мобильных тарифов: страницы под запросы «тарифы с безлимитным
// интернетом», «тарифы без абонентской платы» и т. п. У конкурентов такие страницы
// часто пустые; у нас в индекс идут только подборки с достаточным числом тарифов
// и своими цифрами — сколько тарифов, от скольки и средняя цена.

export type Collection = {
  slug: string;
  title: string; // заголовок страницы и название в списке подборок
  short: string; // короткое название для ссылки
  description: string;
  match: (p: CatalogPlan) => boolean;
  take?: number; // «самые дешёвые» — первые N по цене
};

export const MOBILE_COLLECTIONS: Collection[] = [
  {
    slug: "bezlimitnyj-internet",
    title: "Тарифы с безлимитным интернетом",
    short: "Безлимитный интернет",
    description: "Тарифы мобильной связи без ограничения по гигабайтам.",
    match: (p) => p.mobileGb === UNLIMITED,
  },
  {
    slug: "mnogo-gigabajt",
    title: "Тарифы с большим пакетом интернета",
    short: "От 50 ГБ",
    description: "Тарифы с пакетом от 50 ГБ или безлимитным интернетом.",
    match: (p) => p.mobileGb === UNLIMITED || (p.mobileGb ?? 0) >= 50,
  },
  {
    slug: "bezlimitnye-zvonki",
    title: "Тарифы с безлимитными звонками",
    short: "Безлимитные звонки",
    description: "Тарифы без ограничения по минутам.",
    match: (p) => p.minutes === UNLIMITED,
  },
  {
    slug: "s-esim",
    title: "Тарифы с eSIM",
    short: "С eSIM",
    description: "Тарифы, которые можно подключить на eSIM — без пластиковой карты и визита в салон.",
    match: (p) => p.esim,
  },
  {
    slug: "bez-abonentskoj-platy",
    title: "Тарифы без абонентской платы",
    short: "Без абонплаты",
    description: "Тарифы без ежемесячного платежа: платите только за то, чем пользуетесь.",
    match: (p) => p.priceMonthly === 0,
  },
  {
    slug: "deshevye",
    title: "Самые дешёвые тарифы",
    short: "Самые дешёвые",
    description: "Десять самых доступных тарифов мобильной связи.",
    match: () => true,
    take: 10,
  },
];

/** Меньше этого — страница подборки не индексируется: пустые страницы вредят сайту. */
export const MIN_INDEXABLE = 3;

export function findCollection(slug: string): Collection | undefined {
  return MOBILE_COLLECTIONS.find((c) => c.slug === slug);
}

/** Тарифы подборки, дешёвые сверху. */
export function collectionPlans(c: Collection, plans: CatalogPlan[]): CatalogPlan[] {
  const list = plans.filter(c.match).sort((a, b) => a.priceMonthly - b.priceMonthly);
  return c.take ? list.slice(0, c.take) : list;
}

/** Свои цифры страницы: сколько тарифов, от скольки и медианная цена. */
export function priceStats(plans: CatalogPlan[]): { count: number; min: number; median: number } | null {
  if (plans.length === 0) return null;
  const prices = plans.map((p) => p.priceMonthly).sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 ? prices[mid] : Math.round((prices[mid - 1] + prices[mid]) / 2);
  return { count: prices.length, min: prices[0], median };
}
