import { describe, it, expect } from "vitest";
import {
  BENCHMARK,
  MIN_CLOSED_FOR_TRUST,
  advice,
  funnel,
  visitsForRevenue,
} from "@/lib/unit-economics";

/**
 * Воронка была посчитана в Word-отчёте и не попала в продукт. Оператор,
 * который откручивает рекламу, не видел потолка цены заявки — а он ниже,
 * чем стоит заявка в платном трафике.
 */

describe("воронка в деньги", () => {
  it("на пустой базе считает по бенчмарку и честно это помечает", () => {
    const f = funnel({ confirmed: 0, rejected: 0, revenueRub: 0 });
    expect(f.reliable).toBe(false);
    expect(f.approval).toBe(BENCHMARK.leadToConnection);
    expect(f.avgPayoutRub).toBe(BENCHMARK.payoutRub);
  });

  it("пять закрытых заявок — не статистика", () => {
    const f = funnel({ confirmed: 3, rejected: 2, revenueRub: 6000 });
    expect(f.reliable).toBe(false);
    // 3 из 5 — это не аппрув 60%, это случайность
    expect(f.approval).toBe(BENCHMARK.leadToConnection);
  });

  it("после порога верим своим данным", () => {
    const f = funnel({ confirmed: 20, rejected: 30, revenueRub: 40000 });
    expect(f.closed).toBeGreaterThanOrEqual(MIN_CLOSED_FOR_TRUST);
    expect(f.reliable).toBe(true);
    expect(f.approval).toBeCloseTo(0.4, 5);
    expect(f.avgPayoutRub).toBe(2000);
  });

  it("доход с заявки — это выплата, умноженная на аппрув", () => {
    const f = funnel({ confirmed: 20, rejected: 30, revenueRub: 40000 });
    expect(f.revenuePerLead).toBe(Math.round(0.4 * 2000));
  });

  it("потолок цены заявки ниже дохода с неё: маржа не ноль", () => {
    const f = funnel({ confirmed: 20, rejected: 30, revenueRub: 40000 });
    expect(f.maxLeadCostRub).toBeLessThan(f.revenuePerLead);
    expect(f.maxLeadCostRub).toBeGreaterThan(0);
  });

  it("доход с визита во столько раз меньше, во сколько визит реже заявки", () => {
    const f = funnel({ confirmed: 20, rejected: 30, revenueRub: 40000 });
    expect(f.revenuePerVisit).toBeCloseTo(f.revenuePerLead * BENCHMARK.visitToLead, 1);
  });
});

describe("главный вывод исследования держится", () => {
  it("при оценочном аппруве платный трафик только на грани", () => {
    // 30% × 2000 ₽ = 600 ₽ с заявки, потолок 360 ₽ при марже 40%.
    // Заявка в рекламе стоит 270–407 ₽: дешёвая окупится, дорогая нет.
    const f = funnel({ confirmed: 0, rejected: 0, revenueRub: 0 });
    expect(f.revenuePerLead).toBe(600);
    expect(f.paidTraffic).toBe("edge");
    expect(f.maxLeadCostRub).toBeLessThan(BENCHMARK.paidLeadCostRub[1]);
  });

  it("«на грани» не выдаётся за «окупается»", () => {
    const text = advice(funnel({ confirmed: 0, rejected: 0, revenueRub: 0 }));
    expect(text).toContain("на грани");
    expect(text).toContain("органика");
  });

  it("при высоком аппруве платный трафик начинает проходить", () => {
    const f = funnel({ confirmed: 45, rejected: 15, revenueRub: 90000 });
    expect(f.approval).toBeCloseTo(0.75, 5);
    expect(f.paidTraffic).toBe("yes");
  });

  it("при низком аппруве платить за клик нельзя почти ничего", () => {
    const f = funnel({ confirmed: 5, rejected: 95, revenueRub: 10000 });
    expect(f.maxLeadCostRub).toBeLessThan(BENCHMARK.paidLeadCostRub[0]);
    expect(f.paidTraffic).toBe("no");
  });
});

describe("совет оператору", () => {
  it("на пустой базе говорит, что цифра не своя", () => {
    const text = advice(funnel({ confirmed: 0, rejected: 0, revenueRub: 0 }));
    expect(text).toContain("мало, чтобы верить");
    expect(text).toContain("исследования");
  });

  it("называет потолки в рублях, а не «оптимизируйте кампании»", () => {
    const text = advice(funnel({ confirmed: 20, rejected: 30, revenueRub: 40000 }));
    expect(text).toMatch(/до \d+ ₽/);
    expect(text).toMatch(/за визит — до [\d.]+ ₽/);
  });

  it("при непроходящем платном трафике прямо отправляет в органику", () => {
    const text = advice(funnel({ confirmed: 5, rejected: 95, revenueRub: 10000 }));
    expect(text).toContain("органик");
  });
});

describe("обратная задача", () => {
  it("считает, сколько визитов нужно на сто тысяч в месяц", () => {
    const f = funnel({ confirmed: 20, rejected: 30, revenueRub: 40000 });
    const visits = visitsForRevenue(100_000, f);
    expect(visits).toBeGreaterThan(1000);
    expect(Number.isFinite(visits)).toBe(true);
  });

  it("при нулевом доходе с визита цель недостижима, а не «ноль визитов»", () => {
    const f = funnel({ confirmed: 0, rejected: 0, revenueRub: 0, visitToLead: 0 });
    expect(visitsForRevenue(100_000, f)).toBe(Infinity);
  });
});
