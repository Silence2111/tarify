import { afterEach, describe, expect, it, vi } from "vitest";
import { metrikaId, trackGoal } from "@/lib/analytics";

/**
 * Цели «заявка» и «Оформить» — единственный способ увидеть в Метрике, какие страницы
 * и источники трафика приносят деньги. Сломанный вызов не должен ронять форму заявки.
 */

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("цели аналитики", () => {
  it("номер счётчика — только целое положительное число", () => {
    vi.stubEnv("NEXT_PUBLIC_YANDEX_METRIKA_ID", "12345678");
    expect(metrikaId()).toBe(12345678);
    vi.stubEnv("NEXT_PUBLIC_YANDEX_METRIKA_ID", "abc");
    expect(metrikaId()).toBeNull();
    vi.stubEnv("NEXT_PUBLIC_YANDEX_METRIKA_ID", "");
    expect(metrikaId()).toBeNull();
  });

  it("цель уходит в Метрику и Plausible", () => {
    vi.stubEnv("NEXT_PUBLIC_YANDEX_METRIKA_ID", "12345678");
    const ym = vi.fn();
    const plausible = vi.fn();
    vi.stubGlobal("window", { ym, plausible });
    trackGoal("lead");
    expect(ym).toHaveBeenCalledWith(12345678, "reachGoal", "lead");
    expect(plausible).toHaveBeenCalledWith("lead");
  });

  it("без счётчиков и на сервере — ничего не делает и не падает", () => {
    vi.stubEnv("NEXT_PUBLIC_YANDEX_METRIKA_ID", "");
    vi.stubGlobal("window", {});
    expect(() => trackGoal("partner_click")).not.toThrow();
    vi.unstubAllGlobals();
    expect(() => trackGoal("lead")).not.toThrow();
  });
});
