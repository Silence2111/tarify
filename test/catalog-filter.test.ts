import { describe, expect, it } from "vitest";
import {
  amountText,
  filterCatalogPlans,
  meetsAtLeast,
  NO_FILTERS,
  pickRegion,
} from "@/lib/catalog-filter";
import type { CatalogPlan } from "@/lib/types";

/**
 * Каталог мобильной связи: человек фильтрует по цене, гигабайтам и минутам.
 * Безлимит должен проходить любой порог — иначе самый щедрый тариф пропадает
 * из выдачи ровно тогда, когда человек ищет «побольше гигабайт».
 */

const plan = (id: string, over: Partial<CatalogPlan> = {}): CatalogPlan => ({
  id,
  name: `Тариф ${id}`,
  type: "MOBILE",
  speedMbps: null,
  priceMonthly: 500,
  priceFirst: null,
  hasTv: false,
  tvChannels: null,
  hasMobile: true,
  mobileGb: 20,
  minutes: 500,
  sms: null,
  esim: false,
  region: "Москва",
  url: null,
  erid: null,
  description: null,
  options: [],
  providerName: "МТС",
  providerSlug: "mts",
  ...over,
});

describe("порог «не меньше»", () => {
  it("безлимит проходит любой порог", () => {
    expect(meetsAtLeast(-1, 1000)).toBe(true);
  });
  it("неизвестное количество проходит только без порога", () => {
    expect(meetsAtLeast(null, 0)).toBe(true);
    expect(meetsAtLeast(null, 10)).toBe(false);
  });
});

describe("фильтры каталога", () => {
  const plans = [
    plan("cheap", { priceMonthly: 300, mobileGb: 10, minutes: 200 }),
    plan("unlim", { priceMonthly: 900, mobileGb: -1, minutes: -1, esim: true }),
    plan("mid", { priceMonthly: 600, mobileGb: 40, minutes: 800, providerSlug: "t2", providerName: "t2" }),
  ];

  it("без фильтров — все, дешёвые сверху", () => {
    expect(filterCatalogPlans(plans, NO_FILTERS).map((p) => p.id)).toEqual(["cheap", "mid", "unlim"]);
  });

  it("«от 30 ГБ» оставляет безлимит", () => {
    const ids = filterCatalogPlans(plans, { ...NO_FILTERS, minGb: 30 }).map((p) => p.id);
    expect(ids).toEqual(["mid", "unlim"]);
  });

  it("цена, минуты, eSIM и оператор", () => {
    expect(filterCatalogPlans(plans, { ...NO_FILTERS, maxPrice: 600 }).map((p) => p.id)).toEqual(["cheap", "mid"]);
    expect(filterCatalogPlans(plans, { ...NO_FILTERS, minMinutes: 500 }).map((p) => p.id)).toEqual(["mid", "unlim"]);
    expect(filterCatalogPlans(plans, { ...NO_FILTERS, esimOnly: true }).map((p) => p.id)).toEqual(["unlim"]);
    expect(filterCatalogPlans(plans, { ...NO_FILTERS, provider: "t2" }).map((p) => p.id)).toEqual(["mid"]);
  });

  it("сортировка по гигабайтам: безлимит первым, при равенстве — дешевле", () => {
    const withTwin = [...plans, plan("unlim2", { priceMonthly: 700, mobileGb: -1 })];
    const ids = filterCatalogPlans(withTwin, { ...NO_FILTERS, sort: "gb" }).map((p) => p.id);
    expect(ids).toEqual(["unlim2", "unlim", "mid", "cheap"]);
  });
});

describe("регион по умолчанию", () => {
  it("запрошенный, если в нём есть тарифы", () => {
    expect(pickRegion("Татарстан", ["Москва", "Татарстан"])).toBe("Татарстан");
  });
  it("неизвестный — Москва, без Москвы — первый, без регионов — null", () => {
    expect(pickRegion("Марс", ["Москва", "Татарстан"])).toBe("Москва");
    expect(pickRegion(undefined, ["Татарстан", "Урал"])).toBe("Татарстан");
    expect(pickRegion(undefined, [])).toBeNull();
  });
});

describe("подписи количеств", () => {
  it("число, безлимит, пусто", () => {
    expect(amountText(30, "ГБ")).toBe("30 ГБ");
    expect(amountText(-1, "мин")).toBe("безлимит");
    expect(amountText(null, "SMS")).toBeNull();
  });
});
