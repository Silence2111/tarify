import { describe, expect, it } from "vitest";
import { collectionPlans, findCollection, MOBILE_COLLECTIONS, priceStats } from "@/lib/collections";
import type { CatalogPlan } from "@/lib/types";

/**
 * SEO-подборки — основной канал трафика по плану. Подборка, в которую попал
 * не тот тариф, или «свои цифры» с ошибкой в заголовке — это недоверие и
 * неверная выдача в поиске.
 */

const plan = (id: string, over: Partial<CatalogPlan> = {}): CatalogPlan => ({
  id,
  name: id,
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
  region: null,
  url: null,
  erid: null,
  description: null,
  options: [],
  providerName: "t2",
  providerSlug: "t2",
  ...over,
});

const plans = [
  plan("unlim", { priceMonthly: 990, mobileGb: -1, minutes: -1, esim: true }),
  plan("big", { priceMonthly: 700, mobileGb: 60 }),
  plan("small", { priceMonthly: 300, mobileGb: 10 }),
  plan("free", { priceMonthly: 0, mobileGb: null, minutes: null }),
];

const ids = (slug: string) => collectionPlans(findCollection(slug)!, plans).map((p) => p.id);

describe("подборки", () => {
  it("безлимитный интернет и безлимитные звонки", () => {
    expect(ids("bezlimitnyj-internet")).toEqual(["unlim"]);
    expect(ids("bezlimitnye-zvonki")).toEqual(["unlim"]);
  });

  it("«от 50 ГБ» включает безлимит, дешёвые сверху", () => {
    expect(ids("mnogo-gigabajt")).toEqual(["big", "unlim"]);
  });

  it("eSIM и без абонплаты", () => {
    expect(ids("s-esim")).toEqual(["unlim"]);
    expect(ids("bez-abonentskoj-platy")).toEqual(["free"]);
  });

  it("«самые дешёвые» — первые 10 по цене", () => {
    const many = Array.from({ length: 15 }, (_, i) => plan(`p${i}`, { priceMonthly: 1000 - i * 10 }));
    const cheap = collectionPlans(findCollection("deshevye")!, many);
    expect(cheap).toHaveLength(10);
    expect(cheap[0].priceMonthly).toBe(860);
  });

  it("слаги уникальны, неизвестная подборка — undefined", () => {
    const slugs = MOBILE_COLLECTIONS.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(findCollection("net-takoj")).toBeUndefined();
  });
});

describe("свои цифры страницы", () => {
  it("число тарифов, минимальная и медианная цена", () => {
    expect(priceStats(plans)).toEqual({ count: 4, min: 0, median: 500 });
    expect(priceStats(plans.slice(0, 3))).toEqual({ count: 3, min: 300, median: 700 });
  });
  it("пусто — null", () => {
    expect(priceStats([])).toBeNull();
  });
});
