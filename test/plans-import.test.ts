import { beforeEach, describe, expect, it, vi } from "vitest";

// Слой БД мокаем, как в street-providers.test.ts: проверяем логику импорта
// без реального Postgres.
const db = vi.hoisted(() => ({
  provider: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  plan: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { importPlansCsv, parsePlansCsv } from "@/lib/plans-import";

/**
 * Тарифы раньше заводились только сидом. Провайдер без активных тарифов в
 * выдачу не попадает, поэтому ошибка импорта — это пропавший из поиска
 * провайдер или неверная ставка, по которой считается выручка.
 */

const HEADER = "provider,provider_name,payout,plan,price,price_first,speed,tv,mobile,type,description,options";
const csv = (...lines: string[]) => [HEADER, ...lines].join("\n");

describe("разбор прайса", () => {
  it("строка разбирается во все поля тарифа", () => {
    const { rows, errors } = parsePlansCsv(
      csv(
        'MTS,МТС,1 800,Тёплый приём 200,1 200 ₽,0,200,180,да,bundle,"Интернет + ТВ","Роутер: бесплатно; IP: 150 ₽/мес"',
      ),
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      line: 2,
      provider: "mts", // слаг приводится к нижнему регистру
      providerName: "МТС",
      payout: 1800,
      name: "Тёплый приём 200",
      type: "BUNDLE",
      priceMonthly: 1200,
      priceFirst: 0,
      speedMbps: 200,
      hasTv: true,
      tvChannels: 180,
      hasMobile: true,
      mobileGb: null,
      description: "Интернет + ТВ",
      options: [
        { label: "Роутер", value: "бесплатно" },
        { label: "IP", value: "150 ₽/мес" },
      ],
    });
  });

  it("минимальный файл: только обязательные колонки, тип по умолчанию — INTERNET", () => {
    const { rows, errors } = parsePlansCsv("provider,plan,price\nttk,Базовый 100,500");
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      type: "INTERNET",
      hasTv: false,
      tvChannels: null,
      payout: null,
      providerName: null,
      options: [],
    });
  });

  it("нет обязательной колонки — ошибка сразу", () => {
    expect(parsePlansCsv("provider,plan\nmts,Тариф").errors).toEqual([
      { line: 1, message: 'Нет обязательной колонки "price"' },
    ]);
  });

  it("имя вместо слага, кривая цена и опция без двоеточия — ошибки с номерами строк", () => {
    const { errors } = parsePlansCsv(
      csv(
        "Ростелеком,,,Тариф,600,,,,,,,",
        "rostelecom,,,Тариф,шестьсот,,,,,,,",
        "rostelecom,,,Тариф 2,600,,,,,,,роутер в аренду",
        "rostelecom,,,Тариф 3,600,,,,,SATELLITE,,",
      ),
    );
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4, 5]);
    expect(errors[0].message).toMatch(/слаг латиницей/);
    expect(errors[1].message).toMatch(/price/);
    expect(errors[2].message).toMatch(/название: значение/);
    expect(errors[3].message).toMatch(/type/);
  });

  it("тариф дважды у одного провайдера — ошибка", () => {
    const { errors } = parsePlansCsv(csv("mts,,,Тариф,600,,,,,,,", "mts,,,Тариф,700,,,,,,,"));
    expect(errors).toEqual([{ line: 3, message: "тариф «Тариф» у mts уже есть в строке 2" }]);
  });

  it("разные ставки у одного провайдера — ошибка, одинаковые — нет", () => {
    const same = parsePlansCsv(csv("mts,,1800,А,600,,,,,,,", "mts,,1800,Б,700,,,,,,,"));
    expect(same.errors).toEqual([]);
    const conflict = parsePlansCsv(csv("mts,,1800,А,600,,,,,,,", "mts,,2000,Б,700,,,,,,,"));
    expect(conflict.errors[0]).toMatchObject({ line: 3 });
    expect(conflict.errors[0].message).toMatch(/payout/);
  });
});

describe("загрузка прайса в БД", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.provider.create.mockResolvedValue({ id: "new-provider" });
    db.plan.create.mockImplementation(async ({ data }) => ({ id: `created:${data.name}` }));
  });

  it("при ошибке в файле в БД не пишется ничего", async () => {
    const summary = await importPlansCsv(csv("mts,,,Тариф,600,,,,,,,", "mts,,,Тариф 2,дорого,,,,,,,"));
    expect(summary.errors).toHaveLength(1);
    for (const table of [db.provider, db.plan]) {
      for (const fn of Object.values(table)) expect(fn).not.toHaveBeenCalled();
    }
  });

  it("новый провайдер создаётся с именем и ставкой, тариф — с опциями", async () => {
    db.provider.findUnique.mockResolvedValue(null);
    db.plan.findMany.mockResolvedValue([]);

    const summary = await importPlansCsv(csv('ufanet,Уфанет,1000,Старт,450,,100,,,,,"Роутер: 1 ₽"'));

    expect(db.provider.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { slug: "ufanet", name: "Уфанет", payoutRub: 1000 } }),
    );
    expect(db.plan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          providerId: "new-provider",
          name: "Старт",
          priceMonthly: 450,
          isActive: true,
          options: { create: [{ label: "Роутер", value: "1 ₽" }] },
        }),
      }),
    );
    expect(summary).toMatchObject({ providersCreated: 1, plansCreated: 1, plansUpdated: 0, plansHidden: 0 });
  });

  it("прайс целиком: тариф из файла обновляется и включается, пропавший — скрывается", async () => {
    db.provider.findUnique.mockResolvedValue({ id: "rt" });
    db.plan.findMany.mockResolvedValue([
      { id: "p-keep", name: "Технологии общения 100", isActive: false },
      { id: "p-gone", name: "Игровой 500 + ТВ", isActive: true },
    ]);

    const summary = await importPlansCsv(
      csv("rostelecom,,2752,Технологии общения 100,650,,100,,,,,", "rostelecom,,,Гигабит,1100,,1000,,,,,"),
    );

    // Ставка обновилась, имя не трогали — ячейка пустая.
    expect(db.provider.update).toHaveBeenCalledWith({ where: { id: "rt" }, data: { payoutRub: 2752 } });
    expect(db.plan.update).toHaveBeenCalledWith({
      where: { id: "p-keep" },
      data: expect.objectContaining({
        priceMonthly: 650,
        isActive: true,
        options: { deleteMany: {}, create: [] },
      }),
    });
    expect(db.plan.create).toHaveBeenCalledTimes(1);
    expect(db.plan.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["p-gone"] } },
      data: { isActive: false },
    });
    expect(summary).toMatchObject({ plansCreated: 1, plansUpdated: 1, plansHidden: 1, providersCreated: 0 });
  });

  it("пустые provider_name и payout не трогают карточку провайдера", async () => {
    db.provider.findUnique.mockResolvedValue({ id: "rt" });
    db.plan.findMany.mockResolvedValue([]);

    await importPlansCsv(csv("rostelecom,,,Гигабит,1100,,1000,,,,,"));

    expect(db.provider.update).not.toHaveBeenCalled();
    expect(db.plan.updateMany).not.toHaveBeenCalled();
  });
});
