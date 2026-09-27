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

/**
 * Демо-данные. Своего покрытия у продукта пока нет, поэтому:
 *  - провайдеры вымышленные («Провайдер А» и т. д.). Раньше здесь стояли
 *    Ростелеком, МТС, Билайн с придуманными тарифами, ценами и телефонами —
 *    чужой бренд с выдуманной ценой выглядит как настоящее предложение;
 *  - город один — Казань, и он помечен демо. Три города со списком
 *    на главной читались как «работаем по стране».
 * Настоящие провайдеры появятся вместе с партнёрскими фидами покрытия
 * (импорт CSV в админке).
 */
const PROVIDERS: ProviderSeed[] = [
  { slug: "demo-a", name: "Провайдер А (демо)", phone: "", payoutRub: 2000, plans: [
    { name: "Интернет 100", speedMbps: 100, priceMonthly: 600, priceFirst: 300, description: "Оптика в квартиру, 100 Мбит/с.", options: [{ label: "Роутер", value: "в аренду 99 ₽ в месяц" }] },
    { name: "Интернет 500 и ТВ", speedMbps: 500, priceMonthly: 950, hasTv: true, tvChannels: 200, description: "Скоростной интернет и цифровое ТВ.", options: [{ label: "ТВ-приставка", value: "в комплекте" }] },
  ]},
  { slug: "demo-b", name: "Провайдер Б (демо)", phone: "", payoutRub: 1500, plans: [
    { name: "Интернет 200", speedMbps: 200, priceMonthly: 650, priceFirst: 350, description: "Оптика до дома, до 200 Мбит/с." },
    { name: "Интернет 300, ТВ и связь", speedMbps: 300, priceMonthly: 1050, hasTv: true, tvChannels: 150, hasMobile: true, mobileGb: 20, description: "Интернет, ТВ и мобильная связь одним счётом." },
  ]},
  { slug: "demo-v", name: "Провайдер В (демо)", phone: "", payoutRub: 1200, plans: [
    { name: "Базовый 100", speedMbps: 100, priceMonthly: 500, description: "Недорогой домашний интернет." },
  ]},
  { slug: "demo-g", name: "Провайдер Г (демо)", phone: "", payoutRub: 1800, plans: [
    { name: "Интернет 200 и ТВ", speedMbps: 200, priceMonthly: 700, priceFirst: 0, hasTv: true, tvChannels: 180, description: "Интернет и ТВ, первый месяц бесплатно." },
  ]},
  { slug: "demo-d", name: "Провайдер Д (демо)", phone: "", payoutRub: 1000, plans: [
    { name: "Старт 150", speedMbps: 150, priceMonthly: 550, description: "Местный провайдер." },
    { name: "Максимум 700", speedMbps: 700, priceMonthly: 900, description: "Самая высокая скорость в сети провайдера." },
  ]},
];

type CitySeed = { name: string; region: string; providers: string[]; streets: { name: string; houses: string[] }[] };

const CITIES: CitySeed[] = [
  { name: "Казань", region: "Татарстан", providers: ["demo-a", "demo-b", "demo-v", "demo-g", "demo-d"], streets: [
    { name: "улица Баумана", houses: ["1", "3", "5", "7"] },
    { name: "улица Пушкина", houses: ["10", "12", "14"] },
    { name: "проспект Победы", houses: ["100", "102", "104", "106"] },
    { name: "улица Декабристов", houses: ["2", "4", "6"] },
    { name: "улица Чистопольская", houses: ["20", "22", "24", "26"] },
  ]},
];

async function main() {
  console.log("Очистка...");
  await prisma.lead.deleteMany();
  await prisma.coverage.deleteMany();
  await prisma.planOption.deleteMany();
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
  const tech = ["оптика в квартиру", "оптика до дома", "оптика до дома", "оптика в квартиру", "телефонная линия"];
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

  // Демо-заявки для непустой админки.
  const someBuilding = await prisma.building.findFirst({ include: { street: { include: { city: true } } } });
  const somePlan = await prisma.plan.findFirst();
  if (someBuilding && somePlan) {
    await prisma.lead.create({
      data: {
        name: "Демо-заявка", phone: "+7 900 000-00-00",
        addressText: `${someBuilding.street.city.name}, ${someBuilding.street.name}, д. ${someBuilding.house}`,
        buildingId: someBuilding.id, planId: somePlan.id, status: "NEW",
      },
    });
  }

  console.log("Готово:", {
    провайдеров: await prisma.provider.count(),
    тарифов: await prisma.plan.count(),
    городов: await prisma.city.count(),
    улиц: await prisma.street.count(),
    домов: await prisma.building.count(),
    покрытий: await prisma.coverage.count(),
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
