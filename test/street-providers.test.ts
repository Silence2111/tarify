import { beforeEach, describe, expect, it, vi } from "vitest";

// Мокаем слой БД: тест проверяет логику сведения покрытия улицы к провайдерам
// без реального Postgres. Так же, как это делает страница улицы.
// vi.hoisted — иначе объект недоступен внутри поднятой наверх фабрики vi.mock.
const db = vi.hoisted(() => ({
  city: { findUnique: vi.fn() },
  street: { findUnique: vi.fn() },
  building: { findMany: vi.fn() },
  coverage: { findMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { getStreetProviders } from "@/lib/coverage";

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

// Строка покрытия одного дома для одного провайдера.
const cov = (providerId: string, techNote: string | null, isActive = true) => ({
  providerId,
  techNote,
  provider: {
    id: providerId,
    name: `Провайдер ${providerId}`,
    slug: providerId,
    isActive,
    plans: [plan("p1", 500)],
  },
});

beforeEach(() => {
  vi.clearAllMocks();
  db.city.findUnique.mockResolvedValue({ id: "c1", name: "Город", slug: "gorod" });
  db.street.findUnique.mockResolvedValue({ id: "s1", cityId: "c1", slug: "ulica", name: "Улица" });
  db.building.findMany.mockResolvedValue([{ id: "b1" }, { id: "b2" }]);
});

describe("getStreetProviders", () => {
  it("пометка «оптика» не теряется, если у первого дома улицы её нет", async () => {
    // Регрессия: инлайн-дедуп брал первый дом (techNote=null) и терял оптику
    // со второго. groupByProvider обязан её подтянуть.
    db.coverage.findMany.mockResolvedValue([
      cov("a", null), // дом b1 — без пометки
      cov("a", "оптика в квартиру"), // дом b2 — с оптикой
    ]);

    const res = await getStreetProviders("gorod", "ulica");
    expect(res).not.toBeNull();
    expect(res!.groups).toHaveLength(1);
    expect(res!.groups[0].techNote).toBe("оптика в квартиру");
    expect(res!.buildingCount).toBe(2);
  });

  it("один провайдер на многих домах показывается один раз", async () => {
    db.coverage.findMany.mockResolvedValue([cov("a", "оптика"), cov("a", "оптика")]);
    const res = await getStreetProviders("gorod", "ulica");
    expect(res!.groups).toHaveLength(1);
  });

  it("отключённый провайдер в выдачу не идёт", async () => {
    db.coverage.findMany.mockResolvedValue([cov("a", "оптика", false)]);
    const res = await getStreetProviders("gorod", "ulica");
    expect(res!.groups).toHaveLength(0);
  });
});
