import { describe, expect, it } from "vitest";
import { formatDateTime } from "@/lib/format";

// Сервер Vercel живёт в UTC, а заявки разбирают по московскому времени.
describe("formatDateTime", () => {
  const now = new Date("2026-09-30T12:00:00Z");

  it("время — московское, год текущий не пишется", () => {
    expect(formatDateTime(new Date("2026-09-30T09:45:26Z"), now)).toBe("30 сент., 12:45");
  });

  it("поздний вечер по UTC — уже следующий день в Москве", () => {
    expect(formatDateTime(new Date("2026-03-01T22:05:00Z"), now)).toBe("2 марта, 01:05");
  });

  it("прошлый год — с годом", () => {
    expect(formatDateTime("2025-12-31T20:59:00Z", now)).toBe("31 дек. 2025, 23:59");
    expect(formatDateTime("2025-12-31T21:00:00Z", now)).toBe("1 янв., 00:00");
  });
});
