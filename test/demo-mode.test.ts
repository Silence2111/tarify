import { beforeEach, describe, expect, it, vi } from "vitest";

// Слой БД мокаем, как в postback.test.ts. after() из next/server вне настоящего
// запроса падает — отправку заявки в сеть только фиксируем.
const db = vi.hoisted(() => ({ lead: { create: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: db }));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: vi.fn(),
}));

import { after, NextRequest } from "next/server";
import { POST } from "@/app/api/leads/route";
import nextConfig from "@/next.config.mjs";

/**
 * Демо-режим — выдуманные дома, тарифы и цены. Пока он включён, сайт не должен ни
 * попасть в поиск, ни собирать телефоны: подключать по такой заявке нечего, а
 * персональные данные остались бы в базе. Выключает его только NEXT_PUBLIC_DEMO=0 —
 * пустая или забытая переменная тоже демо.
 */

const LEAD = {
  name: "Анна",
  phone: "+7 900 123-45-67",
  addressText: "Казань, ул. Баумана, 1",
  consent: true,
};

const postLead = () =>
  POST(
    new NextRequest("http://localhost/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(LEAD),
    }),
  );

async function robotsHeader() {
  const rules = await nextConfig.headers!();
  return rules.flatMap((r) => r.headers).find((h) => h.key === "X-Robots-Tag")?.value;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  db.lead.create.mockResolvedValue({ id: "l1" });
});

describe("демо-режим", () => {
  it.each(["1", "", undefined])(
    "NEXT_PUBLIC_DEMO=%s — заявку не принимаем, в базу не пишем",
    async (value) => {
      vi.stubEnv("NEXT_PUBLIC_DEMO", value);
      const res = await postLead();
      expect(res.status).toBe(503);
      expect((await res.json()).error).toMatch(/демо/);
      expect(db.lead.create).not.toHaveBeenCalled();
      expect(after).not.toHaveBeenCalled();
    },
  );

  it("весь сайт отдаётся с noindex", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO", "1");
    expect(await robotsHeader()).toBe("noindex, nofollow");
  });
});

describe("после запуска (NEXT_PUBLIC_DEMO=0)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_DEMO", "0");
  });

  it("заявку принимаем и отправляем дальше", async () => {
    const res = await postLead();
    expect(res.status).toBe(201);
    expect(db.lead.create).toHaveBeenCalledOnce();
    expect(after).toHaveBeenCalledOnce();
  });

  it("сайт открыт поисковикам", async () => {
    expect(await robotsHeader()).toBeUndefined();
  });
});
