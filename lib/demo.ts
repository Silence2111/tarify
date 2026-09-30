import { prisma } from "@/lib/db";

// Демо-данные из сида: покрытие с source = "seed" и тарифы, которые ни разу не
// приходили из прайса (importedAt = null). Перед запуском их убирают кнопкой в
// «Запуске»: реальный импорт добавляется к демо, а не заменяет его, и без очистки
// на сайте остались бы выдуманные дома и тарифы операторов без реального прайса.
// Реальные данные не трогаем: у импортированного покрытия свой source, у тарифов из
// прайса — importedAt.

export const SEED_SOURCE = "seed";

export type DemoCounts = {
  coverage: number; // записей покрытия из сида
  cities: number; // городов, где есть покрытие из сида
  plans: number; // активных тарифов не из прайса
};

export async function getDemoCounts(): Promise<DemoCounts> {
  const [coverage, cities, plans] = await Promise.all([
    prisma.coverage.count({ where: { source: SEED_SOURCE } }),
    prisma.city.count({
      where: {
        streets: { some: { buildings: { some: { coverage: { some: { source: SEED_SOURCE } } } } } },
      },
    }),
    prisma.plan.count({ where: { importedAt: null, isActive: true } }),
  ]);
  return { coverage, cities, plans };
}

export type DemoCleanup = {
  coverage: number;
  buildings: number;
  streets: number;
  cities: number;
  plansHidden: number;
  priceChanges: number;
};

/**
 * Убрать демо-данные одной транзакцией: покрытие из сида, опустевшие после этого
 * дома, улицы и города; тарифы не из прайса скрыть (на них ссылаются заявки и
 * переходы), их историю цен — удалить, чтобы лента не показывала выдуманное.
 */
export async function removeDemoData(): Promise<DemoCleanup> {
  return prisma.$transaction(
    async (tx) => {
      const coverage = await tx.coverage.deleteMany({ where: { source: SEED_SOURCE } });
      // Дом без покрытия поиску не нужен; заявки на него сохранятся с адресом текстом.
      const buildings = await tx.building.deleteMany({ where: { coverage: { none: {} } } });
      const streets = await tx.street.deleteMany({ where: { buildings: { none: {} } } });
      const cities = await tx.city.deleteMany({ where: { streets: { none: {} } } });
      const priceChanges = await tx.priceChange.deleteMany({ where: { plan: { importedAt: null } } });
      const plans = await tx.plan.updateMany({
        where: { importedAt: null, isActive: true },
        data: { isActive: false },
      });
      return {
        coverage: coverage.count,
        buildings: buildings.count,
        streets: streets.count,
        cities: cities.count,
        plansHidden: plans.count,
        priceChanges: priceChanges.count,
      };
    },
    { maxWait: 10_000, timeout: 60_000 },
  );
}
