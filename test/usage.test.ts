import { describe, expect, it } from "vitest";
import { UNLIMITED, type CatalogPlan } from "@/lib/types";
import { covers, hasUsageQuery, matchPlans, parseUsage, savings, usageText } from "@/lib/usage";

/**
 * Подбор под расход обещает «найдём дешевле». Предложить тариф, где гигабайт
 * меньше, чем человеку нужно, или посчитать экономию против неверной цены —
 * значит обмануть того, кто уже готов сменить оператора.
 */

const plan = (id: string, price: number, gb: number | null, minutes: number | null, esim = true) =>
  ({
    id,
    name: id,
    type: "MOBILE",
    priceMonthly: price,
    mobileGb: gb,
    minutes,
    esim,
    providerName: "Оператор",
    providerSlug: "op",
  }) as CatalogPlan;

const PLANS = [
  plan("base15", 400, 15, 300),
  plan("base20", 450, 20, 400),
  plan("t30", 450, 30, 600),
  plan("unlim", 990, UNLIMITED, UNLIMITED),
  plan("noesim50", 650, 50, 1000, false),
];

describe("закрывает ли пакет расход", () => {
  it("безлимит закрывает любой расход, а нужен безлимит — только безлимит", () => {
    expect(covers(UNLIMITED, 50)).toBe(true);
    expect(covers(50, UNLIMITED)).toBe(false);
    expect(covers(UNLIMITED, UNLIMITED)).toBe(true);
  });
  it("неизвестный пакет подходит только тому, кому не нужно", () => {
    expect(covers(null, 0)).toBe(true);
    expect(covers(null, 5)).toBe(false);
  });
});

describe("подбор", () => {
  it("только тарифы с пакетом не меньше нужного, дешёвые сверху, при равной цене — больше ГБ", () => {
    const u = parseUsage({ gb: "20", min: "300" }, PLANS);
    expect(matchPlans(PLANS, u).map((p) => p.id)).toEqual(["t30", "base20", "noesim50", "unlim"]);
  });

  it("eSIM и безлимит сужают выбор", () => {
    expect(matchPlans(PLANS, parseUsage({ gb: "50", esim: "1" }, PLANS)).map((p) => p.id)).toEqual([
      "unlim",
    ]);
    expect(matchPlans(PLANS, parseUsage({ gb: "bezlimit" }, PLANS)).map((p) => p.id)).toEqual([
      "unlim",
    ]);
  });

  it("свой тариф: пакет и цена берутся из него, сам он в выдачу не попадает", () => {
    const u = parseUsage({ my: "base20" }, PLANS);
    expect(u).toMatchObject({ gb: 20, minutes: 400, pay: 450, current: "base20" });
    expect(matchPlans(PLANS, u).map((p) => p.id)).toEqual(["t30", "noesim50", "unlim"]);
  });

  it("явно заданное важнее своего тарифа; чужой id не считается своим тарифом", () => {
    expect(parseUsage({ my: "base20", gb: "5", pay: "600" }, PLANS)).toMatchObject({
      gb: 5,
      minutes: 400,
      pay: 600,
    });
    expect(parseUsage({ my: "нет-такого" }, PLANS).current).toBeNull();
  });

  it("мусор в адресе не ломает страницу: берётся пример по умолчанию", () => {
    const u = parseUsage({ gb: "-5", min: "много", pay: "0" }, PLANS);
    expect(u).toMatchObject({ gb: 20, minutes: 300, pay: null });
    expect(parseUsage({ pay: "1 200 ₽" }, PLANS).pay).toBe(1200);
  });

  it("запрос есть, только если что-то задано", () => {
    expect(hasUsageQuery({ region: "Москва" })).toBe(false);
    expect(hasUsageQuery({ region: "Москва", gb: "20" })).toBe(true);
    expect(hasUsageQuery({ my: "" })).toBe(false);
  });
});

describe("экономия", () => {
  it("в месяц и в год, только если дешевле", () => {
    expect(savings(450, 900)).toEqual({ month: 450, year: 5400 });
    expect(savings(900, 900)).toBeNull();
    expect(savings(450, null)).toBeNull();
  });
  it("текст расхода", () => {
    expect(usageText({ gb: 20, minutes: 300 })).toBe("20 ГБ и 300 минут");
    expect(usageText({ gb: UNLIMITED, minutes: 0 })).toBe("безлимитный интернет и почти без звонков");
  });
});
