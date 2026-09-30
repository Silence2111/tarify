import { describe, expect, it } from "vitest";
import { catalogPath, operatorPath, regionBySlug, regionSlug } from "@/lib/regions";

/**
 * Регион в адресе — это отдельные страницы для поиска: «тарифы МТС Татарстан».
 * Неверный адрес — либо копия чужой страницы (регион по умолчанию под двумя адресами),
 * либо ссылка в никуда.
 */

const REGIONS = ["Москва", "Санкт-Петербург", "Татарстан"];

describe("регион в адресе", () => {
  it("слаги латиницей", () => {
    expect(REGIONS.map(regionSlug)).toEqual(["moskva", "sankt-peterburg", "tatarstan"]);
    expect(regionSlug("Ханты-Мансийский АО — Югра")).toBe("hanty-mansiyskiy-ao-yugra");
  });

  it("регион по слагу — только из тех, где есть цены", () => {
    expect(regionBySlug("tatarstan", REGIONS)).toBe("Татарстан");
    expect(regionBySlug("bashkortostan", REGIONS)).toBeNull();
  });

  it("регион по умолчанию — на базовом адресе, остальные — с регионом в пути", () => {
    expect(catalogPath("/mobile", "Москва", "Москва")).toBe("/mobile");
    expect(catalogPath("/mobile", "Татарстан", "Москва")).toBe("/mobile/tatarstan");
    expect(catalogPath("/mobile/podborka/s-esim", "Санкт-Петербург", "Москва")).toBe(
      "/mobile/podborka/s-esim/sankt-peterburg",
    );
    expect(catalogPath("/mobile", null, "Москва")).toBe("/mobile");
  });
});

describe("адрес оператора в регионе", () => {
  it("свои цены в регионе — адрес с регионом; регион по умолчанию оператора — базовый", () => {
    expect(operatorPath("mts", "Татарстан", REGIONS)).toBe("/mobile/mts/tatarstan");
    expect(operatorPath("mts", "Москва", REGIONS)).toBe("/mobile/mts");
  });

  it("у оператора без Москвы свой регион по умолчанию", () => {
    // Региональный оператор: цены только в Татарстане и Башкортостане.
    expect(operatorPath("letai", "Башкортостан", ["Башкортостан", "Татарстан"])).toBe("/mobile/letai");
    expect(operatorPath("letai", "Татарстан", ["Башкортостан", "Татарстан"])).toBe(
      "/mobile/letai/tatarstan",
    );
  });

  it("без своих цен в регионе (единая цена по России) — базовый адрес", () => {
    expect(operatorPath("tmobile", "Татарстан", [])).toBe("/mobile/tmobile");
    expect(operatorPath("mts", null, REGIONS)).toBe("/mobile/mts");
  });
});
