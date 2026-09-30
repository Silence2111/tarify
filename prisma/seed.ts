import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function slugify(s: string) {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
    й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
    э: "e", ю: "yu", я: "ya", " ": "-", ".": "",
  };
  return s.toLowerCase().split("").map((ch) => map[ch] ?? ch).join("")
    .replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
}

type PlanSeed = {
  name: string; speedMbps?: number; priceMonthly: number; priceFirst?: number;
  hasTv?: boolean; tvChannels?: number; hasMobile?: boolean; mobileGb?: number;
  description?: string; options?: { label: string; value: string }[];
};
type ProviderSeed = { slug: string; name: string; phone: string; payoutRub: number; plans: PlanSeed[] };

const PROVIDERS: ProviderSeed[] = [
  { slug: "rostelecom", name: "Ростелеком", phone: "8 800 100-08-00", payoutRub: 2200, plans: [
    { name: "Технологии общения 100", speedMbps: 100, priceMonthly: 600, priceFirst: 300, description: "Домашний интернет 100 Мбит/с по технологии GPON.", options: [{ label: "Wi-Fi роутер", value: "в аренду 99 ₽/мес" }] },
    { name: "Игровой 500 + ТВ", speedMbps: 500, priceMonthly: 950, hasTv: true, tvChannels: 200, description: "Скоростной интернет и интерактивное ТВ Wink.", options: [{ label: "ТВ-приставка", value: "в комплекте" }] },
  ]},
  { slug: "domru", name: "Дом.ру", phone: "8 800 333-70-00", payoutRub: 1500, plans: [
    { name: "Только интернет 200", speedMbps: 200, priceMonthly: 650, priceFirst: 350, description: "FTTB до 200 Мбит/с." },
    { name: "Интернет 300 + ТВ + Моб.", speedMbps: 300, priceMonthly: 1050, hasTv: true, tvChannels: 150, hasMobile: true, mobileGb: 20, description: "Конвергентный тариф: интернет, ТВ и мобильная связь." },
  ]},
  { slug: "ttk", name: "ТТК", phone: "8 800 775-00-00", payoutRub: 1200, plans: [
    { name: "Базовый 100", speedMbps: 100, priceMonthly: 500, description: "Недорогой домашний интернет." },
  ]},
  { slug: "mts", name: "МТС", phone: "8 800 250-08-90", payoutRub: 1800, plans: [
    { name: "Тёплый приём 200", speedMbps: 200, priceMonthly: 700, priceFirst: 0, hasTv: true, tvChannels: 180, description: "Интернет + ТВ, первый месяц бесплатно." },
  ]},
  { slug: "beeline", name: "Билайн", phone: "8 800 700-80-00", payoutRub: 1500, plans: [
    { name: "Близкие 300", speedMbps: 300, priceMonthly: 750, hasTv: true, tvChannels: 160, description: "Интернет и ТВ для дома." },
    { name: "Всё в одном 500", speedMbps: 500, priceMonthly: 1100, hasTv: true, tvChannels: 200, hasMobile: true, mobileGb: 30, description: "Конвергент: интернет + ТВ + мобильная связь." },
  ]},
  { slug: "mgts", name: "МГТС", phone: "8 495 636-06-36", payoutRub: 2000, plans: [
    { name: "GPON 500", speedMbps: 500, priceMonthly: 800, description: "Оптика до квартиры, до 500 Мбит/с." },
    { name: "GPON 1000 + ТВ", speedMbps: 1000, priceMonthly: 1200, hasTv: true, tvChannels: 220, description: "Гигабит и цифровое ТВ." },
  ]},
  { slug: "twocom", name: "2КОМ", phone: "8 495 727-42-15", payoutRub: 1300, plans: [
    { name: "Домашний 200", speedMbps: 200, priceMonthly: 550, description: "Московский провайдер, FTTB." },
  ]},
  { slug: "skynet", name: "СкайНет", phone: "8 812 313-22-22", payoutRub: 1100, plans: [
    { name: "Скай 300", speedMbps: 300, priceMonthly: 600, description: "Петербургский провайдер, до 300 Мбит/с." },
  ]},
  { slug: "letai", name: "Летай (Таттелеком)", phone: "8 843 000-00-00", payoutRub: 1000, plans: [
    { name: "Летай Старт 150", speedMbps: 150, priceMonthly: 550, description: "Региональный провайдер Татарстана." },
    { name: "Летай Макс 700", speedMbps: 700, priceMonthly: 900, description: "Максимальная скорость на сети Таттелеком." },
  ]},
];

// Мобильная связь: демо-цены для Москвы; в других регионах — с коэффициентом.
// Тарифы операторов с флагом national — единая цена по России (region = null).
const UNLIM = -1; // безлимит в ГБ/минутах/SMS
type MobilePlanSeed = {
  name: string; price: number; gb: number; minutes: number; sms?: number;
  description?: string; options?: { label: string; value: string }[];
};
type MobileSeed = { slug: string; name: string; payoutRub: number; url: string; national?: boolean; plans: MobilePlanSeed[] };

const REGION_PRICE: Record<string, number> = { "Москва": 1, "Санкт-Петербург": 0.95, "Татарстан": 0.8 };

const MOBILE: MobileSeed[] = [
  { slug: "mts", name: "МТС", payoutRub: 1800, url: "https://mts.ru/", plans: [
    { name: "Базовый 20", price: 450, gb: 20, minutes: 400, sms: 100 },
    { name: "Оптимальный 40", price: 700, gb: 40, minutes: 800 },
    { name: "Безлимитный", price: 1100, gb: UNLIM, minutes: 1500, options: [{ label: "Раздача интернета", value: "до 10 ГБ в месяц" }] },
  ]},
  { slug: "beeline", name: "Билайн", payoutRub: 1500, url: "https://beeline.ru/", plans: [
    { name: "Базовый 25", price: 500, gb: 25, minutes: 500 },
    { name: "Оптимальный 50", price: 800, gb: 50, minutes: 1000, sms: 100 },
  ]},
  { slug: "megafon", name: "МегаФон", payoutRub: 300, url: "https://megafon.ru/", plans: [
    { name: "Базовый 15", price: 400, gb: 15, minutes: 300 },
    { name: "Максимум 60", price: 950, gb: 60, minutes: 1200, options: [{ label: "Мессенджеры", value: "без расхода гигабайт" }] },
  ]},
  { slug: "t2", name: "t2", payoutRub: 360, url: "https://t2.ru/", plans: [
    { name: "Базовый 30", price: 450, gb: 30, minutes: 600, options: [{ label: "Мессенджеры", value: "без расхода гигабайт" }] },
    { name: "Расширенный 50", price: 650, gb: 50, minutes: 1000 },
  ]},
  { slug: "yota", name: "Yota", payoutRub: 250, url: "https://yota.ru/", plans: [
    { name: "Конструктор 20", price: 400, gb: 20, minutes: 300 },
  ]},
  { slug: "tmobile", name: "Т-Мобайл", payoutRub: 553, url: "https://www.tbank.ru/", national: true, plans: [
    { name: "Базовый 25", price: 450, gb: 25, minutes: 400, description: "Виртуальный оператор: работает на сетях t2, МТС и Билайна." },
    { name: "Безлимитный", price: 990, gb: UNLIM, minutes: UNLIM },
  ]},
  { slug: "sbermobile", name: "СберМобайл", payoutRub: 351, url: "https://sbermobile.ru/", national: true, plans: [
    { name: "Базовый 20", price: 400, gb: 20, minutes: 500 },
  ]},
];

// Расчётные счета для бизнеса: демо-условия, ставка — за открытый счёт.
type BankSeed = { slug: string; name: string; payoutRub: number; url: string; plans: { name: string; price: number; options: { label: string; value: string }[] }[] };
const BANKS: BankSeed[] = [
  { slug: "tbank", name: "Т-Банк", payoutRub: 8000, url: "https://www.tbank.ru/", plans: [
    { name: "Старт", price: 0, options: [{ label: "Платежи юрлицам", value: "первые 3 бесплатно" }, { label: "Снятие наличных", value: "от 3%" }] },
    { name: "Продвинутый", price: 1990, options: [{ label: "Платежи юрлицам", value: "100 бесплатно" }, { label: "Переводы физлицам", value: "до 400 000 ₽ без комиссии" }] },
  ]},
  { slug: "tochka", name: "Точка", payoutRub: 8000, url: "https://tochka.com/", plans: [
    { name: "Старт", price: 0, options: [{ label: "Платежи юрлицам", value: "5 бесплатно" }, { label: "Снятие наличных", value: "от 3%" }] },
    { name: "Бизнес", price: 2100, options: [{ label: "Платежи юрлицам", value: "без ограничений" }, { label: "Переводы физлицам", value: "до 500 000 ₽ без комиссии" }] },
  ]},
  { slug: "alfabank", name: "Альфа-Банк", payoutRub: 8000, url: "https://alfabank.ru/", plans: [
    { name: "Базовый", price: 0, options: [{ label: "Платежи юрлицам", value: "по 99 ₽" }, { label: "Снятие наличных", value: "от 2%" }] },
  ]},
];

type CitySeed = { name: string; region: string; providers: string[]; streets: { name: string; houses: string[] }[] };

const CITIES: CitySeed[] = [
  { name: "Казань", region: "Татарстан", providers: ["rostelecom", "domru", "ttk", "mts", "letai"], streets: [
    { name: "улица Баумана", houses: ["1", "3", "5", "7"] },
    { name: "улица Пушкина", houses: ["10", "12", "14"] },
    { name: "проспект Победы", houses: ["100", "102", "104", "106"] },
    { name: "улица Декабристов", houses: ["2", "4", "6"] },
    { name: "улица Чистопольская", houses: ["20", "22", "24", "26"] },
  ]},
  { name: "Москва", region: "Москва", providers: ["rostelecom", "domru", "mts", "beeline", "mgts", "twocom"], streets: [
    { name: "Тверская улица", houses: ["1", "5", "9", "13"] },
    { name: "Ленинский проспект", houses: ["30", "32", "34", "36"] },
    { name: "улица Арбат", houses: ["2", "4", "6", "8"] },
    { name: "Кутузовский проспект", houses: ["21", "23", "25"] },
    { name: "Профсоюзная улица", houses: ["40", "42", "44", "46"] },
    { name: "улица Тверская-Ямская", houses: ["3", "5", "7"] },
  ]},
  { name: "Санкт-Петербург", region: "Санкт-Петербург", providers: ["rostelecom", "domru", "mts", "beeline", "skynet"], streets: [
    { name: "Невский проспект", houses: ["20", "22", "24", "28"] },
    { name: "Лиговский проспект", houses: ["50", "52", "54"] },
    { name: "Московский проспект", houses: ["100", "102", "104", "106"] },
    { name: "улица Рубинштейна", houses: ["3", "5", "7"] },
    { name: "Большой проспект П.С.", houses: ["60", "62", "64"] },
  ]},
];

async function main() {
  console.log("Очистка...");
  await prisma.lead.deleteMany();
  await prisma.coverage.deleteMany();
  await prisma.planOption.deleteMany();
  await prisma.priceChange.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.building.deleteMany();
  await prisma.street.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.city.deleteMany();

  console.log("Провайдеры и тарифы...");
  const providerId: Record<string, string> = {};
  for (const p of PROVIDERS) {
    const created = await prisma.provider.create({
      data: {
        slug: p.slug, name: p.name, phone: p.phone, payoutRub: p.payoutRub,
        plans: {
          create: p.plans.map((pl) => ({
            name: pl.name, speedMbps: pl.speedMbps ?? null, priceMonthly: pl.priceMonthly,
            priceFirst: pl.priceFirst ?? null, hasTv: pl.hasTv ?? false, tvChannels: pl.tvChannels ?? null,
            hasMobile: pl.hasMobile ?? false, mobileGb: pl.mobileGb ?? null, description: pl.description ?? null,
            options: pl.options ? { create: pl.options } : undefined,
          })),
        },
      },
    });
    providerId[p.slug] = created.id;
  }

  console.log("Города, улицы, дома, покрытие...");
  const tech = ["GPON", "FTTB", "FTTB", "GPON", "ADSL"];
  let bIdx = 0;
  for (const city of CITIES) {
    const cityRow = await prisma.city.create({
      data: { slug: slugify(city.name), name: city.name, region: city.region },
    });
    const cityProviders = city.providers;
    for (const sd of city.streets) {
      const street = await prisma.street.create({
        data: { cityId: cityRow.id, slug: slugify(sd.name), name: sd.name },
      });
      for (const house of sd.houses) {
        const building = await prisma.building.create({ data: { streetId: street.id, house } });
        // 2–4 провайдера на дом, состав варьируется по индексу.
        const offset = bIdx % cityProviders.length;
        const count = 2 + (bIdx % 3); // 2..4
        const chosen: string[] = [];
        for (let k = 0; k < count && k < cityProviders.length; k++) {
          chosen.push(cityProviders[(offset + k) % cityProviders.length]);
        }
        for (let i = 0; i < chosen.length; i++) {
          await prisma.coverage.create({
            data: {
              buildingId: building.id,
              providerId: providerId[chosen[i]],
              techNote: tech[(bIdx + i) % tech.length],
              source: "seed",
            },
          });
        }
        bIdx++;
      }
    }
  }

  console.log("Мобильная связь и счета для бизнеса...");
  for (const op of MOBILE) {
    let id = providerId[op.slug];
    if (!id) {
      id = (await prisma.provider.create({ data: { slug: op.slug, name: op.name, payoutRub: op.payoutRub } })).id;
      providerId[op.slug] = id;
    }
    const regions: (string | null)[] = op.national ? [null] : Object.keys(REGION_PRICE);
    for (const region of regions) {
      const k = region ? REGION_PRICE[region] : 1;
      for (const pl of op.plans) {
        await prisma.plan.create({
          data: {
            providerId: id, type: "MOBILE", name: pl.name,
            priceMonthly: Math.round((pl.price * k) / 10) * 10,
            hasMobile: true, mobileGb: pl.gb, minutes: pl.minutes, sms: pl.sms ?? null, esim: true,
            region, url: op.url, description: pl.description ?? null,
            options: pl.options ? { create: pl.options } : undefined,
          },
        });
      }
    }
  }
  for (const bank of BANKS) {
    const created = await prisma.provider.create({ data: { slug: bank.slug, name: bank.name, payoutRub: bank.payoutRub } });
    for (const pl of bank.plans) {
      await prisma.plan.create({
        data: {
          providerId: created.id, type: "BUSINESS_ACCOUNT", name: pl.name, priceMonthly: pl.price,
          url: bank.url, options: { create: pl.options },
        },
      });
    }
  }

  // Демо-история цен: лента «Изменения цен» и пометки «подорожал/подешевел» на карточках.
  // На проде историю пишет импорт прайса.
  console.log("История цен...");
  const DAY = 24 * 60 * 60 * 1000;
  const yota = providerId["yota"];
  if (yota) {
    await prisma.plan.create({
      data: {
        providerId: yota, type: "MOBILE", name: "Конструктор 10", priceMonthly: 300, isActive: false,
        hasMobile: true, mobileGb: 10, minutes: 200, esim: true, region: "Москва",
      },
    });
  }
  const CHANGES: { slug: string; plan: string; region: string | null; kind: "UP" | "DOWN" | "NEW" | "REMOVED"; old?: number; daysAgo: number }[] = [
    { slug: "t2", plan: "Расширенный 50", region: "Москва", kind: "NEW", daysAgo: 3 },
    { slug: "mts", plan: "Базовый 20", region: "Москва", kind: "UP", old: 400, daysAgo: 6 },
    { slug: "mts", plan: "Базовый 20", region: "Татарстан", kind: "UP", old: 330, daysAgo: 6 },
    { slug: "megafon", plan: "Максимум 60", region: "Москва", kind: "UP", old: 890, daysAgo: 12 },
    { slug: "yota", plan: "Конструктор 10", region: "Москва", kind: "REMOVED", old: 300, daysAgo: 12 },
    { slug: "beeline", plan: "Базовый 25", region: "Москва", kind: "DOWN", old: 550, daysAgo: 20 },
    { slug: "rostelecom", plan: "Технологии общения 100", region: null, kind: "UP", old: 550, daysAgo: 25 },
  ];
  for (const c of CHANGES) {
    const plan = await prisma.plan.findFirst({
      where: { provider: { slug: c.slug }, name: c.plan, region: c.region },
    });
    if (!plan) continue;
    await prisma.priceChange.create({
      data: {
        planId: plan.id, kind: c.kind,
        oldPrice: c.kind === "NEW" ? null : (c.old ?? null),
        newPrice: c.kind === "REMOVED" ? null : plan.priceMonthly,
        createdAt: new Date(Date.now() - c.daysAgo * DAY),
      },
    });
  }

  // Демо-заявки для непустой админки.
  const someBuilding = await prisma.building.findFirst({ include: { street: { include: { city: true } } } });
  const somePlan = await prisma.plan.findFirst({ where: { type: { in: ["INTERNET", "BUNDLE"] } } });
  if (someBuilding && somePlan) {
    await prisma.lead.create({
      data: {
        name: "Иван Петров", phone: "+7 900 123-45-67",
        addressText: `${someBuilding.street.city.name}, ${someBuilding.street.name}, д. ${someBuilding.house}`,
        buildingId: someBuilding.id, planId: somePlan.id, status: "NEW",
      },
    });
  }

  console.log("Готово:", {
    провайдеров: await prisma.provider.count(),
    тарифов: await prisma.plan.count(),
    мобильных: await prisma.plan.count({ where: { type: "MOBILE" } }),
    счетов: await prisma.plan.count({ where: { type: "BUSINESS_ACCOUNT" } }),
    городов: await prisma.city.count(),
    улиц: await prisma.street.count(),
    домов: await prisma.building.count(),
    покрытий: await prisma.coverage.count(),
    'изменений цен': await prisma.priceChange.count(),
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
