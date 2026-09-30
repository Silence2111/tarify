import { describe, expect, it } from "vitest";
import { launchChecks, launchProgress, type LaunchFacts } from "@/lib/launch";
import { dataRecipients, missingOperatorFields, operatorDetails } from "@/lib/operator";

/**
 * «Запуск» говорит, можно ли принимать настоящие заявки. Показать «готово» там, где
 * не готово, — значит запуститься с демо-домами, без согласия с реквизитами или без
 * приёма статусов, то есть без денег.
 */

const EMPTY: LaunchFacts = {
  env: {},
  demo: { coverage: 171, cities: 3, plans: 53 },
  realPlans: { home: 0, mobile: 0, business: 0 },
  realCoverage: 0,
  partnerLinks: 0,
  linksWithoutSubid: 0,
  networkStatuses: 0,
};

const READY: LaunchFacts = {
  env: {
    DIRECT_URL: "postgresql://direct",
    NEXT_PUBLIC_SITE_URL: "https://tarify.ru",
    NEXT_PUBLIC_DEMO: "0",
    POSTBACK_TOKEN: "t",
    OPERATOR_NAME: "ООО «Тарифы»",
    OPERATOR_INN: "1650000000",
    OPERATOR_OGRN: "1231600000000",
    OPERATOR_ADDRESS: "Казань, ул. Баумана, 1",
    OPERATOR_EMAIL: "pd@tarify.ru",
    PD_RECIPIENTS: "ООО «Пампаду»",
    NEXT_PUBLIC_YANDEX_METRIKA_ID: "12345678",
  },
  demo: { coverage: 0, cities: 0, plans: 0 },
  realPlans: { home: 12, mobile: 40, business: 5 },
  realCoverage: 900,
  partnerLinks: 30,
  linksWithoutSubid: 0,
  networkStatuses: 3,
};

const find = (facts: LaunchFacts, title: string) =>
  launchChecks(facts)
    .flatMap((g) => g.checks)
    .find((c) => c.title.startsWith(title))!;

describe("чек-лист запуска", () => {
  it("свежий сайт на демо-данных — почти всё «нужно сделать»", () => {
    const { done, total } = launchProgress(launchChecks(EMPTY));
    expect(done).toBe(0);
    expect(total).toBeGreaterThan(8);
    expect(find(EMPTY, "Демо-данные убраны")).toMatchObject({ status: "todo" });
    expect(find(EMPTY, "Демо-данные убраны").hint).toContain("171 запись в 3 городах");
  });

  it("всё настроено — готово всё обязательное; ручные пункты остаются «проверьте сами»", () => {
    const groups = launchChecks(READY);
    const { done, total } = launchProgress(groups);
    expect(done).toBe(total);
    expect(find(READY, "Уведомление Роскомнадзора")).toMatchObject({ status: "manual" });
  });

  it("по желанию — не в счёт «готово N из M»", () => {
    const withTelegram = { ...READY, env: { ...READY.env, TELEGRAM_BOT_TOKEN: "x", TELEGRAM_CHANNEL_ID: "@c" } };
    expect(launchProgress(launchChecks(withTelegram)).total).toBe(launchProgress(launchChecks(READY)).total);
    expect(find(READY, "Telegram")).toMatchObject({ status: "todo", optional: true });
  });

  it("localhost — не боевой адрес; ссылки без {subid} — не готово", () => {
    const local = { ...READY, env: { ...READY.env, NEXT_PUBLIC_SITE_URL: "http://localhost:3000" } };
    expect(find(local, "Адрес сайта").status).toBe("todo");
    const noSubid = { ...READY, linksWithoutSubid: 4 };
    expect(find(noSubid, "Метка {subid}")).toMatchObject({ status: "todo" });
    expect(find(noSubid, "Метка {subid}").hint).toContain("4");
  });

  it("пункт про {subid} появляется, только когда есть партнёрские ссылки", () => {
    expect(launchChecks(EMPTY).flatMap((g) => g.checks).some((c) => c.title.includes("{subid}"))).toBe(false);
  });
});

describe("реквизиты оператора", () => {
  it("строка реквизитов и недостающие поля", () => {
    expect(operatorDetails(READY.env)).toBe(
      "ООО «Тарифы», ИНН 1650000000, ОГРН 1231600000000, адрес: Казань, ул. Баумана, 1, e-mail: pd@tarify.ru",
    );
    expect(missingOperatorFields({ OPERATOR_NAME: "ИП Иванов", OPERATOR_INN: " " })).toEqual([
      "ИНН",
      "ОГРН или ОГРНИП",
      "адрес",
      "e-mail",
    ]);
  });
  it("без наименования — нет строки; получатели — как заданы", () => {
    expect(operatorDetails({ OPERATOR_INN: "1" })).toBeNull();
    expect(dataRecipients({ PD_RECIPIENTS: " ООО «Пампаду» " })).toBe("ООО «Пампаду»");
    expect(dataRecipients({})).toBeNull();
  });
});
