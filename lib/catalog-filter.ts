import { UNLIMITED, type CatalogPlan } from "@/lib/types";

// Фильтры каталогов (мобильная связь, счета для бизнеса). Чистые функции:
// работают и в клиентском компоненте, и в тестах.

export type CatalogFilters = {
  maxPrice: number; // 0 — без ограничения
  minGb: number;
  minMinutes: number;
  esimOnly: boolean;
  provider: string; // слаг оператора; "" — все
  sort: "price" | "gb";
};

export const NO_FILTERS: CatalogFilters = {
  maxPrice: 0,
  minGb: 0,
  minMinutes: 0,
  esimOnly: false,
  provider: "",
  sort: "price",
};

/** «Не меньше N»: безлимит проходит любой порог, неизвестное количество — только нулевой. */
export function meetsAtLeast(value: number | null, min: number): boolean {
  if (!min) return true;
  if (value === UNLIMITED) return true;
  return (value ?? 0) >= min;
}

/** Для сортировки по гигабайтам: безлимит — больше любого пакета. */
export const gbRank = (v: number | null) => (v === UNLIMITED ? Number.POSITIVE_INFINITY : (v ?? 0));

export function filterCatalogPlans(plans: CatalogPlan[], f: CatalogFilters): CatalogPlan[] {
  const list = plans.filter(
    (p) =>
      (!f.maxPrice || p.priceMonthly <= f.maxPrice) &&
      meetsAtLeast(p.mobileGb, f.minGb) &&
      meetsAtLeast(p.minutes, f.minMinutes) &&
      (!f.esimOnly || p.esim) &&
      (!f.provider || p.providerSlug === f.provider),
  );
  return [...list].sort((a, b) => {
    if (f.sort === "gb") {
      const byGb = gbRank(b.mobileGb) - gbRank(a.mobileGb);
      if (byGb) return byGb; // два безлимита дают NaN — дальше решает цена
    }
    return a.priceMonthly - b.priceMonthly;
  });
}

/**
 * Региональная цена важнее единой: если у провайдера есть тариф с тем же названием в
 * прайсе региона, тариф с единой ценой по России в этом регионе не показываем — иначе
 * один тариф висел бы дважды по разной цене. owner — чей тариф (в общих списках).
 */
export function preferRegional<T extends { name: string; region: string | null }>(
  plans: T[],
  owner: (p: T) => string = () => "",
): T[] {
  const regional = new Set(plans.filter((p) => p.region).map((p) => `${owner(p)}\n${p.name}`));
  return plans.filter((p) => p.region || !regional.has(`${owner(p)}\n${p.name}`));
}

/**
 * Какой регион показать. Запрошенный — если в нём есть тарифы, иначе Москва,
 * иначе первый по алфавиту. null — регионов нет, только тарифы с единой ценой.
 */
export function pickRegion(requested: string | undefined, regions: string[]): string | null {
  if (requested && regions.includes(requested)) return requested;
  if (regions.includes("Москва")) return "Москва";
  return regions[0] ?? null;
}

/** «30 ГБ», «безлимит»; null, если количество не указано. */
export function amountText(value: number | null, unit: string): string | null {
  if (value == null) return null;
  if (value === UNLIMITED) return "безлимит";
  return `${value.toLocaleString("ru-RU")} ${unit}`;
}
