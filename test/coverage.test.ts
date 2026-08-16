import { describe, expect, it } from "vitest";
import { groupByProvider, type CoverageRow } from "@/lib/coverage";
import { formatRub, plural, slugify } from "@/lib/format";

/**
 * Выдача провайдеров по адресу — то, ради чего сюда приходят, и то, из чего
 * растут деньги: заявка на провайдера, которого в доме нет, не превращается
 * в подключение, а комиссию платят только за подтверждённое.
 *
 * Тестов в проекте не было вовсе, поэтому начинаем с места, где ошибка
 * напрямую стоит выручки.
 */

const plan = (id: string, price: number) => ({
  id,
  name: `Тариф ${id}`,
  type: "internet",
  speedMbps: 100,
  priceMonthly: price,
  priceFirst: null,
  hasTv: false,
  tvChannels: null,
  hasMobile: false,
  mobileGb: null,
  description: null,
  options: [],
});

const row = (
  providerId: string,
  over: Partial<CoverageRow> & { isActive?: boolean; plans?: unknown[]; techNote?: string | null } = {},
): CoverageRow =>
  ({
    providerId,
    techNote: over.techNote ?? null,
    provider: {
      id: providerId,
      name: `Провайдер ${providerId}`,
      slug: providerId,
      isActive: over.isActive ?? true,
      plans: (over.plans as never) ?? [plan("p1", 500)],
    },
  }) as CoverageRow;

describe("группировка провайдеров", () => {
  it("один провайдер на многих домах показывается один раз", () => {
    // Иначе на улице из тридцати домов он появится тридцать раз
    const groups = groupByProvider([row("a"), row("a"), row("a")]);
    expect(groups).toHaveLength(1);
  });

  it("разные провайдеры не схлопываются", () => {
    expect(groupByProvider([row("a"), row("b")])).toHaveLength(2);
  });

  it("отключённый провайдер в выдачу не идёт", () => {
    expect(groupByProvider([row("a", { isActive: false })])).toHaveLength(0);
  });

  it("провайдер без активных тарифов не показывается", () => {
    // Заявка на него не станет подключением, а лид без оплаты тратит доверие
    expect(groupByProvider([row("a", { plans: [] })])).toHaveLength(0);
  });

  it("технология подбирается, даже если у первого дома её нет", () => {
    // Оптика важнее для решения, чем отсутствие пометки у соседнего дома
    const groups = groupByProvider([
      row("a", { techNote: null }),
      row("a", { techNote: "оптика в квартиру" }),
    ]);
    expect(groups[0].techNote).toBe("оптика в квартиру");
  });

  it("первая указанная технология не затирается пустой", () => {
    const groups = groupByProvider([
      row("a", { techNote: "оптика" }),
      row("a", { techNote: null }),
    ]);
    expect(groups[0].techNote).toBe("оптика");
  });

  it("тарифы переносятся в выдачу", () => {
    const groups = groupByProvider([row("a", { plans: [plan("p1", 400), plan("p2", 800)] })]);
    expect(groups[0].plans.map((p) => p.priceMonthly)).toEqual([400, 800]);
  });

  it("пустое покрытие даёт пустую выдачу, а не падение", () => {
    expect(groupByProvider([])).toEqual([]);
  });
});

describe("форматирование", () => {
  it("рубли с разделителем разрядов", () => {
    expect(formatRub(12500).replace(/\s/g, " ")).toBe("12 500 ₽");
  });

  it("слаг из русского названия", () => {
    expect(slugify("Улица Ленина")).toBe("ulica-lenina");
    expect(slugify("Проспект  Мира.")).toBe("prospekt-mira");
  });

  it("слаг не начинается и не кончается дефисом", () => {
    const s = slugify(" — Тестовая — ");
    expect(s.startsWith("-")).toBe(false);
    expect(s.endsWith("-")).toBe(false);
  });

  it("склонение не ломается на 11–14", () => {
    expect(plural(1, "провайдер", "провайдера", "провайдеров")).toBe("провайдер");
    expect(plural(3, "провайдер", "провайдера", "провайдеров")).toBe("провайдера");
    expect(plural(11, "провайдер", "провайдера", "провайдеров")).toBe("провайдеров");
    expect(plural(22, "провайдер", "провайдера", "провайдеров")).toBe("провайдера");
  });
});
