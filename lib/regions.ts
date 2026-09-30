import { pickRegion } from "@/lib/catalog-filter";
import { slugify } from "@/lib/format";

// Регион в адресе страницы: /mobile/tatarstan, /mobile/mts/tatarstan,
// /mobile/podborka/s-esim/tatarstan. Раньше регион был параметром ?region=, и для
// поиска у оператора была одна страница на все регионы; «тарифы МТС Татарстан» — это
// отдельный запрос со своими ценами. Регион по умолчанию живёт на базовом адресе:
// /mobile/moskva был бы копией /mobile.

export function regionSlug(region: string): string {
  return slugify(region);
}

/** Регион по его слагу в адресе; null — такого региона с ценами нет. */
export function regionBySlug(slug: string, regions: string[]): string | null {
  return regions.find((r) => regionSlug(r) === slug) ?? null;
}

/** Адрес каталога в регионе: /mobile + /tatarstan; для региона по умолчанию — базовый адрес. */
export function catalogPath(base: string, region: string | null, defaultRegion: string | null): string {
  return region && region !== defaultRegion ? `${base}/${regionSlug(region)}` : base;
}

/**
 * Адрес страницы оператора в регионе. Регион по умолчанию у оператора свой (Москва, если
 * там есть его цены), и живёт он на /mobile/<оператор>. Где у оператора нет своих цен —
 * тоже базовый адрес: там его тарифы с единой ценой.
 */
export function operatorPath(slug: string, region: string | null, operatorRegions: string[]): string {
  if (!region || !operatorRegions.includes(region)) return `/mobile/${slug}`;
  return catalogPath(`/mobile/${slug}`, region, pickRegion(undefined, operatorRegions));
}
