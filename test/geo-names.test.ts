import { describe, expect, it } from "vitest";
import { inCity } from "@/lib/geo-names";

describe("inCity — город в предложном падеже", () => {
  it("крупные города — из словаря, в том числе с исключениями", () => {
    expect(inCity("Казань")).toBe("в Казани");
    expect(inCity("Москва")).toBe("в Москве");
    expect(inCity("Санкт-Петербург")).toBe("в Санкт-Петербурге");
    expect(inCity("Ярославль")).toBe("в Ярославле");
    expect(inCity("Владивосток")).toBe("во Владивостоке");
    expect(inCity("Нижний Новгород")).toBe("в Нижнем Новгороде");
    expect(inCity("Набережные Челны")).toBe("в Набережных Челнах");
    expect(inCity("Орёл")).toBe("в Орле");
  });

  it("простые случаи — правилом", () => {
    expect(inCity("Ухта")).toBe("в Ухте");
    expect(inCity("Анапа")).toBe("в Анапе");
    expect(inCity("Гатчина")).toBe("в Гатчине");
    expect(inCity("Обнинск")).toBe("в Обнинске");
    expect(inCity("Всеволожск")).toBe("во Всеволожске");
    expect(inCity("Выборг")).toBe("в Выборге");
  });

  it("где правило ненадёжно — «в городе …», а не ошибка", () => {
    expect(inCity("Елец")).toBe("в городе Елец");
    expect(inCity("Нарьян-Мар")).toBe("в городе Нарьян-Мар");
    expect(inCity("Ессентуки")).toBe("в городе Ессентуки");
    expect(inCity("Пушкино")).toBe("в городе Пушкино");
    expect(inCity("Гусь-Хрустальный")).toBe("в городе Гусь-Хрустальный");
    expect(inCity("Кемь")).toBe("в городе Кемь");
  });
});
