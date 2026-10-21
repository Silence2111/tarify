import { beforeEach, describe, expect, it, vi } from "vitest";

// Слой БД мокаем, как в postback.test.ts.
const db = vi.hoisted(() => ({
  city: { findFirst: vi.fn() },
  plan: { findFirst: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { hasAddressSearch } from "@/lib/home";

/**
 * Главная с поиском по адресу имеет смысл, только когда искать есть что: города и
 * тарифы домашнего интернета. После «Убрать демо-данные» без своего покрытия (запуск с
 * мобильной связи) главная ведёт в мобильную связь — иначе посетитель увидел бы
 * «0 провайдеров, 0 домов» и поиск, который ничего не находит.
 */

beforeEach(() => {
  vi.clearAllMocks();
  db.city.findFirst.mockResolvedValue({ id: "c1" });
  db.plan.findFirst.mockResolvedValue({ id: "p1" });
});

describe("главная: искать ли по адресу", () => {
  it("есть города и тарифы домашнего интернета — поиск по адресу", async () => {
    expect(await hasAddressSearch()).toBe(true);
    expect(db.plan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true, type: { in: ["INTERNET", "TV", "BUNDLE"] } } }),
    );
  });

  it("демо убрано, покрытия нет — мобильная связь", async () => {
    db.city.findFirst.mockResolvedValue(null);
    expect(await hasAddressSearch()).toBe(false);
  });

  it("города есть, а тарифов домашнего интернета нет — мобильная связь", async () => {
    db.plan.findFirst.mockResolvedValue(null);
    expect(await hasAddressSearch()).toBe(false);
  });

  it("база не ответила — как раньше, с поиском по адресу", async () => {
    db.city.findFirst.mockRejectedValue(new Error("connection refused"));
    expect(await hasAddressSearch()).toBe(true);
  });
});
