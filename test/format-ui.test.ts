import { describe, expect, it } from "vitest";
import { phoneError, techLabel } from "@/lib/format";

describe("технология по-русски", () => {
  it("переводит коды из фидов", () => {
    expect(techLabel("GPON")).toBe("оптика в квартиру");
    expect(techLabel(" fttb ")).toBe("оптика до дома");
    expect(techLabel("ADSL")).toBe("телефонная линия");
  });
  it("оставляет уже русский текст и пустое", () => {
    expect(techLabel("оптика до дома")).toBe("оптика до дома");
    expect(techLabel(null)).toBeNull();
  });
});

describe("проверка телефона", () => {
  it("принимает обычные записи", () => {
    expect(phoneError("+7 900 123-45-67")).toBeNull();
    expect(phoneError("89001234567")).toBeNull();
  });
  it("объясняет, что не так", () => {
    expect(phoneError("")).toBe("Укажите телефон");
    expect(phoneError("123")).toMatch(/неполным/);
  });
});
