import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => {
  const counted = (count: number) => vi.fn().mockResolvedValue({ count });
  const tx = {
    coverage: { deleteMany: counted(171) },
    building: { deleteMany: counted(57) },
    street: { deleteMany: counted(16) },
    city: { deleteMany: counted(3) },
    priceChange: { deleteMany: counted(7) },
    plan: { updateMany: counted(53) },
  };
  return { tx, $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) };
});
vi.mock("@/lib/db", () => ({ prisma: db }));

import { removeDemoData } from "@/lib/demo";

/**
 * Очистка демо-данных запускается на проде. Лишнее условие — и вместе с демо уйдут
 * реальные дома или тарифы из прайса; недостающее — на сайте останутся выдуманные.
 */

describe("очистка демо-данных", () => {
  beforeEach(() => vi.clearAllMocks());

  it("одной транзакцией: покрытие из сида, опустевшие дома, улицы и города, тарифы не из прайса", async () => {
    expect(await removeDemoData()).toEqual({
      coverage: 171,
      buildings: 57,
      streets: 16,
      cities: 3,
      plansHidden: 53,
      priceChanges: 7,
    });
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    const { tx } = db;
    expect(tx.coverage.deleteMany).toHaveBeenCalledWith({ where: { source: "seed" } });
    expect(tx.building.deleteMany).toHaveBeenCalledWith({ where: { coverage: { none: {} } } });
    expect(tx.street.deleteMany).toHaveBeenCalledWith({ where: { buildings: { none: {} } } });
    expect(tx.city.deleteMany).toHaveBeenCalledWith({ where: { streets: { none: {} } } });
    // Тарифы не удаляются, а скрываются: на них ссылаются заявки и переходы.
    expect(tx.plan.updateMany).toHaveBeenCalledWith({
      where: { importedAt: null, isActive: true },
      data: { isActive: false },
    });
    expect(tx.priceChange.deleteMany).toHaveBeenCalledWith({ where: { plan: { importedAt: null } } });
  });

  it("порядок: сначала покрытие, потом опустевшие дома, улицы, города", async () => {
    await removeDemoData();
    const order = [
      db.tx.coverage.deleteMany,
      db.tx.building.deleteMany,
      db.tx.street.deleteMany,
      db.tx.city.deleteMany,
    ].map((fn) => fn.mock.invocationCallOrder[0]);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});
