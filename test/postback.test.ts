import { beforeEach, describe, expect, it, vi } from "vitest";

// Слой БД мокаем, как в plans-import.test.ts.
const db = vi.hoisted(() => ({
  click: { findUnique: vi.fn(), update: vi.fn() },
  lead: { findUnique: vi.fn(), update: vi.fn() },
}));
vi.mock("@/lib/db", () => ({ prisma: db }));

import { applyPostback } from "@/lib/postback";

/**
 * Постбэк — единственный источник правды о деньгах: сеть сообщает, что одобрено и
 * сколько заплатят. Метка может быть переходом по «Оформить» или заявкой с обзвоном;
 * перепутать их или откатить одобренное — значит показать в админке не те деньги.
 */

const params = (q: string) => new URLSearchParams(q);

beforeEach(() => {
  vi.clearAllMocks();
  db.click.findUnique.mockResolvedValue(null);
  db.lead.findUnique.mockResolvedValue(null);
});

describe("постбэк", () => {
  it("без метки или статуса — 400, в базу не ходим", async () => {
    expect(await applyPostback(params("status=approved"))).toMatchObject({ ok: false, code: 400 });
    expect(await applyPostback(params("subid=c1"))).toMatchObject({ ok: false, code: 400 });
    expect(db.click.findUnique).not.toHaveBeenCalled();
  });

  it("неизвестная метка — 404", async () => {
    expect(await applyPostback(params("subid=zzz&status=approved"))).toMatchObject({
      ok: false,
      code: 404,
    });
  });

  it("переход: статус, сумма и сеть записываются", async () => {
    db.click.findUnique.mockResolvedValue({ id: "c1", status: null });
    const r = await applyPostback(params("sub1=c1&status=Check&payout=360.00&network=pampadu"));
    expect(r).toEqual({ ok: true, target: "click", applied: true });
    expect(db.click.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: expect.objectContaining({
        status: "HOLD",
        statusRaw: "Check",
        payoutRub: 360,
        network: "pampadu",
      }),
    });
    expect(db.lead.findUnique).not.toHaveBeenCalled();
  });

  it("заявка: одобрено — «Подключён» и сумма от сети", async () => {
    db.lead.findUnique.mockResolvedValue({ id: "l1", status: "CALLED", networkStatus: "HOLD" });
    const r = await applyPostback(params("subid=l1&status=approved&payout=1 800"));
    expect(r).toEqual({ ok: true, target: "lead", applied: true });
    expect(db.lead.update).toHaveBeenCalledWith({
      where: { id: "l1" },
      data: expect.objectContaining({
        status: "CONFIRMED",
        networkStatus: "APPROVED",
        networkStatusRaw: "approved",
        payoutRub: 1800,
      }),
    });
  });

  it("заявка: «в обработке» делает новую заявку «в работе», сумму без значения не трогает", async () => {
    db.lead.findUnique.mockResolvedValue({ id: "l2", status: "NEW", networkStatus: null });
    await applyPostback(params("subid=l2&status=pending"));
    const data = db.lead.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: "CALLED", networkStatus: "PENDING" });
    expect(data).not.toHaveProperty("payoutRub");
  });

  it("поздний промежуточный статус после одобрения игнорируется, но ответ — успех", async () => {
    db.lead.findUnique.mockResolvedValue({ id: "l3", status: "CONFIRMED", networkStatus: "APPROVED" });
    expect(await applyPostback(params("subid=l3&status=pending"))).toEqual({
      ok: true,
      target: "lead",
      applied: false,
    });
    db.click.findUnique.mockResolvedValue({ id: "c2", status: "APPROVED" });
    expect(await applyPostback(params("subid=c2&status=hold"))).toMatchObject({ applied: false });
    expect(db.lead.update).not.toHaveBeenCalled();
    expect(db.click.update).not.toHaveBeenCalled();
  });
});
