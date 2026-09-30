import { describe, expect, it } from "vitest";
import { COMMENT_MAX, parseLeadUpdate } from "@/lib/lead-update";

describe("parseLeadUpdate", () => {
  it("статус, заметка или оба сразу", () => {
    expect(parseLeadUpdate({ status: "CALLED" })).toEqual({ data: { status: "CALLED" } });
    expect(parseLeadUpdate({ comment: " перезвонить в 18:00 " })).toEqual({
      data: { comment: "перезвонить в 18:00" },
    });
    expect(parseLeadUpdate({ status: "REJECTED", comment: "дорого" })).toEqual({
      data: { status: "REJECTED", comment: "дорого" },
    });
  });

  it("пустая заметка удаляет её, длинная обрезается", () => {
    expect(parseLeadUpdate({ comment: "   " })).toEqual({ data: { comment: null } });
    const long = parseLeadUpdate({ comment: "я".repeat(COMMENT_MAX + 50) });
    expect("data" in long && long.data.comment).toHaveLength(COMMENT_MAX);
  });

  it("чужой статус, не строка или пустое тело — ошибка", () => {
    expect(parseLeadUpdate({ status: "PAID" })).toHaveProperty("error");
    expect(parseLeadUpdate({ comment: 42 })).toHaveProperty("error");
    expect(parseLeadUpdate({})).toHaveProperty("error");
    expect(parseLeadUpdate(null)).toHaveProperty("error");
  });
});
