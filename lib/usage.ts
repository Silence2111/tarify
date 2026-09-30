import { gbRank, meetsAtLeast } from "@/lib/catalog-filter";
import { UNLIMITED, type CatalogPlan } from "@/lib/types";

// Подбор мобильного тарифа под расход: человек говорит, сколько тратит и платит,
// и видит подходящие тарифы по цене и свою экономию. «Переплачиваю ли я за связь»
// приводит на сайт тех, кто уже готов сменить тариф. Чистые функции: страница и тесты.

export type Usage = {
  gb: number; // ГБ в месяц; 0 — интернет не нужен; -1 — нужен безлимит
  minutes: number; // минут в месяц; 0 — почти не звонит; -1 — нужен безлимит
  esim: boolean;
  pay: number | null; // сколько платит сейчас, ₽/мес
  current: string | null; // id своего тарифа из каталога
};

export const GB_CHOICES = [
  { value: 5, label: "до 5 ГБ" },
  { value: 10, label: "10 ГБ" },
  { value: 20, label: "20 ГБ" },
  { value: 30, label: "30 ГБ" },
  { value: 50, label: "50 ГБ" },
  { value: UNLIMITED, label: "безлимит" },
];

export const MINUTE_CHOICES = [
  { value: 0, label: "почти не звоню" },
  { value: 100, label: "100 минут" },
  { value: 300, label: "300 минут" },
  { value: 600, label: "600 минут" },
  { value: 1000, label: "1000 минут" },
  { value: UNLIMITED, label: "безлимит" },
];

/** Типичные профили — для тех, кто не знает свой расход. */
export const PRESETS = [
  { label: "Мессенджеры и почта", gb: 5, minutes: 300 },
  { label: "Соцсети и музыка", gb: 20, minutes: 300 },
  { label: "Видео каждый день", gb: 50, minutes: 600 },
  { label: "Раздаю интернет на ноутбук", gb: UNLIMITED, minutes: 300 },
];

/** Пример на странице без запроса: средний расход. */
export const DEFAULT_USAGE: Usage = { gb: 20, minutes: 300, esim: false, pay: null, current: null };

export type Params = Record<string, string | string[] | undefined>;

/** Значение параметра адреса: первое, без пробелов по краям; нет — пустая строка. */
export function param(sp: Params, key: string): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

/** Количество из адреса: число или «bezlimit»; мусор и отрицательные — null. */
function parseAmount(raw: string): number | null {
  if (!raw) return null;
  if (raw === "bezlimit" || raw === String(UNLIMITED)) return UNLIMITED;
  if (!/^\d{1,5}$/.test(raw)) return null;
  return Number(raw);
}

/** Для адреса: безлимит — словом, чтобы ссылку можно было прочитать. */
export function amountParam(v: number): string {
  return v === UNLIMITED ? "bezlimit" : String(v);
}

/** Есть ли в адресе запрос (иначе страница показывает пример и индексируется). */
export function hasUsageQuery(sp: Params): boolean {
  return ["gb", "min", "pay", "my"].some((k) => param(sp, k) !== "");
}

/**
 * Расход из адреса. Выбран свой тариф — пакет и цена берутся из него, если не
 * заданы явно: «найди то же, но дешевле».
 */
export function parseUsage(sp: Params, plans: CatalogPlan[]): Usage {
  const current = plans.find((p) => p.id === param(sp, "my")) ?? null;
  const payRaw = param(sp, "pay").replace(/[\s₽]/g, "");
  const pay = /^\d{1,6}$/.test(payRaw) && Number(payRaw) > 0 ? Number(payRaw) : null;
  return {
    gb: parseAmount(param(sp, "gb")) ?? current?.mobileGb ?? (current ? 0 : DEFAULT_USAGE.gb),
    minutes:
      parseAmount(param(sp, "min")) ?? current?.minutes ?? (current ? 0 : DEFAULT_USAGE.minutes),
    esim: ["1", "on", "true"].includes(param(sp, "esim")),
    pay: pay ?? current?.priceMonthly ?? null,
    current: current?.id ?? null,
  };
}

/** Закрывает ли пакет потребность: безлимит закрывает любую, а нужен безлимит — только безлимит. */
export function covers(value: number | null, need: number): boolean {
  if (need === UNLIMITED) return value === UNLIMITED;
  return meetsAtLeast(value, need);
}

/** Подходящие тарифы: дешёвые сверху, при равной цене — с большим пакетом. Свой тариф не предлагаем. */
export function matchPlans(plans: CatalogPlan[], u: Usage): CatalogPlan[] {
  return plans
    .filter(
      (p) =>
        p.id !== u.current &&
        covers(p.mobileGb, u.gb) &&
        covers(p.minutes, u.minutes) &&
        (!u.esim || p.esim),
    )
    .sort((a, b) => a.priceMonthly - b.priceMonthly || gbRank(b.mobileGb) - gbRank(a.mobileGb) || 0);
}

/** Экономия против текущего платежа; null — если не дешевле. */
export function savings(price: number, pay: number | null): { month: number; year: number } | null {
  if (pay == null || price >= pay) return null;
  return { month: pay - price, year: (pay - price) * 12 };
}

/** «20 ГБ и 300 минут», «безлимитный интернет и почти без звонков». */
export function usageText(u: Pick<Usage, "gb" | "minutes">): string {
  const gb =
    u.gb === UNLIMITED ? "безлимитный интернет" : u.gb === 0 ? "без интернета" : `${u.gb} ГБ`;
  const min =
    u.minutes === UNLIMITED
      ? "безлимитные звонки"
      : u.minutes === 0
        ? "почти без звонков"
        : `${u.minutes} минут`;
  return `${gb} и ${min}`;
}
