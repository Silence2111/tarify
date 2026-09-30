import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";

/**
 * CSV готовят в Excel и Google Таблицах. Русский Excel сохраняет через «;» и
 * с BOM — раньше такой файл не узнавался вовсе («нет обязательной колонки»).
 */
describe("parseCsv", () => {
  it("кавычки: запятая внутри поля и экранированная кавычка", () => {
    expect(parseCsv('a,b\n"1, 2","он сказал ""да"""\n')).toEqual([
      ["a", "b"],
      ["1, 2", 'он сказал "да"'],
    ]);
  });

  it("BOM в начале не попадает в первую колонку", () => {
    expect(parseCsv("﻿city,street\nКазань,Баумана")[0]).toEqual(["city", "street"]);
  });

  it("разделитель «;» определяется по заголовку", () => {
    expect(parseCsv("provider;plan;price\r\nmts;Тёплый приём 200;700\r\n")).toEqual([
      ["provider", "plan", "price"],
      ["mts", "Тёплый приём 200", "700"],
    ]);
  });

  it("в файле через «;» запятая — обычный символ", () => {
    expect(parseCsv("a;b\nИнтернет, ТВ;1")[1]).toEqual(["Интернет, ТВ", "1"]);
  });

  it("пустые строки пропускаются", () => {
    expect(parseCsv("a,b\n\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});
