import { describe, expect, it } from "vitest";
import { isBot, parseConversionStatus, parsePayout, refererPath, withSubid } from "@/lib/partner";

/**
 * Переходы и постбэк — единственный способ увидеть деньги с кнопки «Оформить».
 * Потерянная метка или неверно понятый статус — это доход, который не виден
 * в админке, и ставка оператора, которую не с чем сверить.
 */

describe("метка перехода в партнёрской ссылке", () => {
  it("подставляется в query", () => {
    expect(withSubid("https://ad.net/go?offer=1&subid={subid}", "c1")).toBe(
      "https://ad.net/go?offer=1&subid=c1",
    );
  });

  it("подставляется в путь, где скобки хранятся закодированными", () => {
    // Так ссылку сохраняет импорт: new URL(...).toString() кодирует {} в пути.
    const stored = new URL("https://ad.admitad.com/g/abc/{subid}/").toString();
    expect(withSubid(stored, "c2")).toBe("https://ad.admitad.com/g/abc/c2/");
  });

  it("без плейсхолдера ссылка не меняется, пустая метка — пустое место", () => {
    expect(withSubid("https://t2.ru/", "c3")).toBe("https://t2.ru/");
    expect(withSubid("https://ad.net/?subid={subid}", "")).toBe("https://ad.net/?subid=");
  });
});

describe("статус из постбэка", () => {
  it("слова Pampadu", () => {
    expect(parseConversionStatus("Approved")).toBe("APPROVED");
    expect(parseConversionStatus("Check")).toBe("HOLD");
    expect(parseConversionStatus("Pending")).toBe("PENDING");
    expect(parseConversionStatus("Declined")).toBe("REJECTED");
  });

  it("слова Admitad", () => {
    expect(parseConversionStatus("approved_but_stalled")).toBe("HOLD");
    expect(parseConversionStatus("declined")).toBe("REJECTED");
  });

  it("незнакомое слово — в обработке", () => {
    expect(parseConversionStatus("что-то новое")).toBe("PENDING");
  });
});

describe("сумма из постбэка", () => {
  it("целые, с копейками, с пробелами и запятой", () => {
    expect(parsePayout("750")).toBe(750);
    expect(parsePayout("750.00")).toBe(750);
    expect(parsePayout("1 234,5")).toBe(1235);
  });
  it("мусор и пусто — null", () => {
    expect(parsePayout("abc")).toBeNull();
    expect(parsePayout("")).toBeNull();
    expect(parsePayout(null)).toBeNull();
  });
});

describe("роботы и откуда перешли", () => {
  it("роботов и пустой user-agent не считаем", () => {
    expect(isBot("Mozilla/5.0 (compatible; YandexBot/3.0)")).toBe(true);
    expect(isBot(null)).toBe(true);
    expect(isBot("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/604.1")).toBe(false);
  });
  it("путь берём только со своего сайта", () => {
    expect(refererPath("https://tarify.ru/mobile?region=X", "tarify.ru")).toBe("/mobile?region=X");
    expect(refererPath("https://other.ru/page", "tarify.ru")).toBeNull();
    expect(refererPath("не ссылка", "tarify.ru")).toBeNull();
  });
});
