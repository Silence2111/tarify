import { beforeEach, describe, expect, it, vi } from "vitest";

// Слой БД мокаем, как в street-providers.test.ts: проверяем логику импорта
// без реального Postgres.
const db = vi.hoisted(() => ({
  provider: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  plan: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  priceChange: { createMany: vi.fn() },
  // Транзакция в тестах — тот же мок: проверяем, что и в каком порядке пишется.
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
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

  it("мобильный тариф: безлимит, минуты, SMS, eSIM, регион, ссылка и erid", () => {
    const { rows, errors } = parsePlansCsv(
      [
        "provider,plan,price,gb,minutes,sms,esim,region,url,erid,type",
        "t2,Базовый 30,450,безлимит,500,безлимит,да,Москва,https://t2.ru/?utm=1,2VtzqwXYZ,mobile",
      ].join("\n"),
    );
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({
      type: "MOBILE",
      hasMobile: true,
      mobileGb: -1,
      minutes: 500,
      sms: -1,
      esim: true,
      region: "Москва",
      url: "https://t2.ru/?utm=1",
      erid: "2VtzqwXYZ",
    });
  });

  it("колонка mobile — синоним gb, цена 0 допустима", () => {
    const { rows, errors } = parsePlansCsv("provider,plan,price,mobile,type\ntbank,Старт,0,,business_account");
    expect(errors).toEqual([]);
    expect(rows[0]).toMatchObject({ priceMonthly: 0, type: "BUSINESS_ACCOUNT", hasMobile: false });
  });

  it("ссылка только http(s), eSIM — только да/нет", () => {
    const { errors } = parsePlansCsv(
      [
        "provider,plan,price,url,esim",
        "t2,А,450,javascript:alert(1),",
        "t2,Б,450,не ссылка,",
        "t2,В,450,,может быть",
      ].join("\n"),
    );
    expect(errors.map((e) => e.line)).toEqual([2, 3, 4]);
    expect(errors[0].message).toMatch(/http/);
    expect(errors[1].message).toMatch(/ссылк/);
    expect(errors[2].message).toMatch(/esim/);
  });

  it("один тариф в разных регионах — не повтор, в одном регионе — повтор", () => {
    const text = (r2: string) =>
      ["provider,plan,price,region", "mts,Базовый 20,450,Москва", `mts,Базовый 20,360,${r2}`].join("\n");
    expect(parsePlansCsv(text("Татарстан")).errors).toEqual([]);
    expect(parsePlansCsv(text("Москва")).errors[0].message).toMatch(/Москва.*строке 2/);
  });

  it("разные ставки у одного провайдера — ошибка, одинаковые — нет", () => {
    const same = parsePlansCsv(csv("mts,,1800,А,600,,,,,,,", "mts,,1800,Б,700,,,,,,,"));
    expect(same.errors).toEqual([]);
    const conflict = parsePlansCsv(csv("mts,,1800,А,600,,,,,,,", "mts,,2000,Б,700,,,,,,,"));
    expect(conflict.errors[0]).toMatchObject({ line: 3 });
    expect(conflict.errors[0].message).toMatch(/payout/);
  });
});

describe("номера строк в ошибках", () => {
  it("считаются по файлу: пустые строки и переносы внутри кавычек не сдвигают номер", () => {
    const { errors } = parsePlansCsv(
      'provider,plan,price,description\nmts,A,100,"две\nстроки"\n\nmts,B,дорого,',
    );
    expect(errors).toEqual([{ line: 5, message: expect.stringContaining("price") }]);
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
    for (const table of [db.provider, db.plan, db.priceChange]) {
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
      { id: "p-keep", name: "Технологии общения 100", isActive: false, priceMonthly: 600 },
      { id: "p-gone", name: "Игровой 500 + ТВ", isActive: true, priceMonthly: 900 },
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

  it("прайс одного региона не трогает тарифы другого", async () => {
    db.provider.findUnique.mockResolvedValue({ id: "mts" });
    // В базе у МТС тарифы в Москве и в Татарстане; грузим только Москву.
    db.plan.findMany.mockImplementation(async ({ where }) =>
      where.region === "Москва"
        ? [
            { id: "msk-keep", name: "Базовый 20", isActive: true, priceMonthly: 450 },
            { id: "msk-gone", name: "Старый", isActive: true, priceMonthly: 300 },
          ]
        : [{ id: "kzn", name: "Базовый 20", isActive: true, priceMonthly: 360 }],
    );

    const summary = await importPlansCsv("provider,plan,price,region,type\nmts,Базовый 20,470,Москва,MOBILE");

    expect(db.plan.findMany).toHaveBeenCalledTimes(1);
    expect(db.plan.findMany.mock.calls[0][0].where).toEqual({
      providerId: "mts",
      region: "Москва",
      type: { in: ["MOBILE"] },
    });
    expect(db.plan.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["msk-gone"] } },
      data: { isActive: false },
    });
    expect(summary).toMatchObject({ plansUpdated: 1, plansHidden: 1 });
  });

  it("история цен: подорожание, снижение, новый и снятый тариф", async () => {
    db.provider.findUnique.mockResolvedValue({ id: "mts" });
    db.plan.findMany.mockResolvedValue([
      { id: "up", name: "Базовый 20", isActive: true, priceMonthly: 450 },
      { id: "down", name: "Оптимальный 40", isActive: true, priceMonthly: 750 },
      { id: "same", name: "Безлимитный", isActive: true, priceMonthly: 1100 },
      { id: "gone", name: "Старый", isActive: true, priceMonthly: 300 },
    ]);

    const summary = await importPlansCsv(
      "provider,plan,price,region,type\n" +
        "mts,Базовый 20,500,Москва,MOBILE\n" +
        "mts,Оптимальный 40,700,Москва,MOBILE\n" +
        "mts,Безлимитный,1100,Москва,MOBILE\n" +
        "mts,Новый 60,900,Москва,MOBILE",
    );

    expect(db.priceChange.createMany).toHaveBeenCalledWith({
      data: [
        { planId: "up", kind: "UP", oldPrice: 450, newPrice: 500 },
        { planId: "down", kind: "DOWN", oldPrice: 750, newPrice: 700 },
        { planId: "created:Новый 60", kind: "NEW", oldPrice: null, newPrice: 900 },
        { planId: "gone", kind: "REMOVED", oldPrice: 300, newPrice: null },
      ],
    });
    expect(summary.pricesChanged).toBe(2);
    // Для поста в Telegram: с названиями тарифов, в том числе только что созданного.
    expect(summary.changes).toEqual([
      { provider: "mts", plan: "Базовый 20", region: "Москва", kind: "UP", oldPrice: 450, newPrice: 500 },
      { provider: "mts", plan: "Оптимальный 40", region: "Москва", kind: "DOWN", oldPrice: 750, newPrice: 700 },
      { provider: "mts", plan: "Новый 60", region: "Москва", kind: "NEW", oldPrice: null, newPrice: 900 },
      { provider: "mts", plan: "Старый", region: "Москва", kind: "REMOVED", oldPrice: 300, newPrice: null },
    ]);
  });

  it("первая загрузка прайса — не новость; вернувшийся скрытый тариф — новый", async () => {
    db.provider.findUnique.mockResolvedValue({ id: "t2" });
    db.plan.findMany.mockResolvedValueOnce([]);
    await importPlansCsv("provider,plan,price\nt2,Базовый 30,450");
    expect(db.priceChange.createMany).not.toHaveBeenCalled();

    db.plan.findMany.mockResolvedValueOnce([
      { id: "back", name: "Базовый 30", isActive: false, priceMonthly: 400 },
    ]);
    const summary = await importPlansCsv("provider,plan,price\nt2,Базовый 30,450");
    expect(db.priceChange.createMany).toHaveBeenCalledWith({
      data: [{ planId: "back", kind: "NEW", oldPrice: null, newPrice: 450 }],
    });
    expect(summary.pricesChanged).toBe(0);
  });

  it("прайс мобильной связи не трогает домашний интернет того же провайдера", async () => {
    db.provider.findUnique.mockResolvedValue({ id: "rt", name: "Ростелеком" });
    // В базе домашние тарифы Ростелекома без региона; грузим его мобильные — тоже без региона.
    db.plan.findMany.mockImplementation(async ({ where }) =>
      where.type.in.includes("MOBILE") ? [] : [{ id: "home", name: "Технологии общения 100", isActive: true, priceMonthly: 600 }],
    );

    const summary = await importPlansCsv("provider,plan,price,type\nrostelecom,Мобильный 20,350,MOBILE");

    expect(db.plan.findMany.mock.calls[0][0].where).toEqual({
      providerId: "rt",
      region: null,
      type: { in: ["MOBILE"] },
    });
    expect(db.plan.updateMany).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ plansCreated: 1, plansHidden: 0 });
  });

  it("домашние типы — один раздел: тариф из INTERNET в BUNDLE обновляется, а не дублируется", async () => {
    db.provider.findUnique.mockResolvedValue({ id: "rt" });
    db.plan.findMany.mockResolvedValue([
      { id: "p1", name: "Всё в одном", isActive: true, priceMonthly: 900 },
    ]);
    await importPlansCsv("provider,plan,price,type\nrostelecom,Всё в одном,900,BUNDLE");
    expect(db.plan.findMany.mock.calls[0][0].where.type).toEqual({ in: ["INTERNET", "TV", "BUNDLE"] });
    expect(db.plan.update).toHaveBeenCalledTimes(1);
    expect(db.plan.create).not.toHaveBeenCalled();
  });

  it("без истории (первый реальный прайс поверх демо) — цены обновляются, лента молчит", async () => {
    db.provider.findUnique.mockResolvedValue({ id: "mts" });
    db.plan.findMany.mockResolvedValue([
      { id: "demo", name: "Базовый 20", isActive: true, priceMonthly: 450 },
      { id: "demo-only", name: "Демо-тариф", isActive: true, priceMonthly: 300 },
    ]);
    const summary = await importPlansCsv("provider,plan,price\nmts,Базовый 20,650", { history: false });
    expect(db.plan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ priceMonthly: 650 }) }),
    );
    expect(db.plan.updateMany).toHaveBeenCalled(); // демо-тариф скрыт
    expect(db.priceChange.createMany).not.toHaveBeenCalled();
    expect(summary).toMatchObject({ pricesChanged: 0, changes: [] });
  });

  it("пустые provider_name и payout не трогают карточку провайдера", async () => {
    db.provider.findUnique.mockResolvedValue({ id: "rt" });
    db.plan.findMany.mockResolvedValue([]);

    await importPlansCsv(csv("rostelecom,,,Гигабит,1100,,1000,,,,,"));

    expect(db.provider.update).not.toHaveBeenCalled();
    expect(db.plan.updateMany).not.toHaveBeenCalled();
  });
});
