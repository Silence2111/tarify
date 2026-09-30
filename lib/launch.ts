import type { DemoCounts } from "@/lib/demo";
import { plural } from "@/lib/format";
import { missingOperatorFields } from "@/lib/operator";

// Чек-лист запуска для страницы «Запуск» в админке: что уже готово на проде, а что
// ещё нет. Собирается из переменных окружения и цифр из базы; чистая функция — её
// проверяют тесты. «manual» — то, что сайт проверить не может (уведомление в РКН);
// optional — пункты «по желанию»: в «готово N из M» они не входят.

export type CheckStatus = "ok" | "todo" | "manual";
export type Check = { title: string; status: CheckStatus; hint: string; optional?: boolean };
export type LaunchGroup = { title: string; checks: Check[] };

export type LaunchFacts = {
  env: Record<string, string | undefined>;
  demo: DemoCounts;
  realPlans: { home: number; mobile: number; business: number };
  realCoverage: number;
  partnerLinks: number; // тарифы из прайса со ссылкой «Оформить» (у демо-тарифов ссылки не партнёрские)
  linksWithoutSubid: number; // из них без метки {subid}
  networkStatuses: number; // переходов и заявок со статусом от сети
};

const has = (env: LaunchFacts["env"], key: string) => Boolean(env[key]?.trim());

export function launchChecks(f: LaunchFacts): LaunchGroup[] {
  const { env } = f;
  const site = env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";
  const siteOk = site !== "" && !/localhost|127\.0\.0\.1/.test(site);
  const realPlans = f.realPlans.home + f.realPlans.mobile + f.realPlans.business;
  const demoLeft = f.demo.coverage + f.demo.plans;
  const missingOperator = missingOperatorFields(env);

  return [
    {
      title: "Сайт и база",
      checks: [
        {
          title: "Прямое подключение к базе (DIRECT_URL)",
          status: has(env, "DIRECT_URL") ? "ok" : "todo",
          hint: has(env, "DIRECT_URL")
            ? "Сборка на Vercel сама обновляет схему базы."
            : "Без неё сборка на Vercel остановится на обновлении схемы базы.",
        },
        {
          title: "Адрес сайта (NEXT_PUBLIC_SITE_URL)",
          status: siteOk ? "ok" : "todo",
          hint: siteOk
            ? site
            : "Боевой адрес https://… — для canonical, sitemap.xml и ссылок в постах.",
        },
        {
          title: "Общие лимиты на заявки (Upstash Redis)",
          status: has(env, "UPSTASH_REDIS_REST_URL") && has(env, "UPSTASH_REDIS_REST_TOKEN") ? "ok" : "todo",
          optional: true,
          hint: "Без Redis защита от спама считается в каждом инстансе Vercel отдельно.",
        },
      ],
    },
    {
      title: "Данные",
      checks: [
        {
          title: "Реальные прайсы загружены",
          status: realPlans > 0 ? "ok" : "todo",
          hint:
            realPlans > 0
              ? `Из прайсов: домашний интернет — ${f.realPlans.home}, мобильная связь — ${f.realPlans.mobile}, счета — ${f.realPlans.business}.`
              : "Пока все тарифы — демо. Загрузите прайсы в «Тарифах» (data/PLANS.md).",
        },
        {
          title: "Реальное покрытие загружено",
          status: f.realCoverage > 0 ? "ok" : "todo",
          hint:
            f.realCoverage > 0
              ? `Записей покрытия из фидов: ${f.realCoverage}.`
              : f.demo.coverage > 0
                ? "Без покрытия поиск по адресу покажет только демо-дома (data/COVERAGE.md)."
                : "Без покрытия поиск по адресу ничего не найдёт (data/COVERAGE.md).",
        },
        {
          title: "Демо-данные убраны",
          status: demoLeft === 0 ? "ok" : "todo",
          hint:
            demoLeft === 0
              ? "Покрытия из сида и демо-тарифов не осталось."
              : `${demoSummary(f.demo)} Убирайте после загрузки реальных прайсов.`,
        },
        {
          title: "Демо-режим выключен (NEXT_PUBLIC_DEMO=0)",
          status: env.NEXT_PUBLIC_DEMO === "0" ? "ok" : "todo",
          hint:
            env.NEXT_PUBLIC_DEMO === "0"
              ? "Плашки нет, история цен пишется."
              : "Выключите, когда зальёте реальные прайсы и уберёте демо-данные; нужен redeploy. Пока режим включён, история цен не пишется.",
        },
      ],
    },
    {
      title: "Деньги",
      checks: [
        {
          title: "Партнёрские ссылки в тарифах",
          status: f.partnerLinks > 0 ? "ok" : "todo",
          hint:
            f.partnerLinks > 0
              ? `Тарифов с кнопкой «Оформить»: ${f.partnerLinks}.`
              : "Ссылки из кабинета CPA-сети — в колонку url прайса; без них только заявки с обзвоном.",
        },
        ...(f.partnerLinks > 0
          ? [
              {
                title: "Метка {subid} в партнёрских ссылках",
                status: (f.linksWithoutSubid === 0 ? "ok" : "todo") as CheckStatus,
                hint:
                  f.linksWithoutSubid === 0
                    ? "Постбэк сможет сопоставить оплату с переходом."
                    : `Ссылок без {subid}: ${f.linksWithoutSubid} — оплату по ним не с чем будет сопоставить.`,
              },
            ]
          : []),
        {
          title: "Приём статусов от сетей (POSTBACK_TOKEN)",
          status: has(env, "POSTBACK_TOKEN") ? "ok" : "todo",
          hint: has(env, "POSTBACK_TOKEN")
            ? "Адрес постбэка для кабинета сети — в «Переходах»."
            : "Без токена статусы и суммы от сетей не принимаются.",
        },
        {
          title: "Сети присылают статусы",
          status: f.networkStatuses > 0 ? "ok" : "manual",
          hint:
            f.networkStatuses > 0
              ? `Статусов от сетей получено: ${f.networkStatuses}.`
              : "Пока не было ни одного — отправьте тестовый постбэк из кабинета сети.",
        },
        {
          title: "Автопередача заявок в сеть или CRM (LEAD_WEBHOOK_URL)",
          status: has(env, "LEAD_WEBHOOK_URL") ? "ok" : "todo",
          optional: true,
          hint: "Без неё заявки передаются в сеть выгрузкой CSV.",
        },
      ],
    },
    {
      title: "Юридическое",
      checks: [
        {
          title: "Реквизиты оператора в согласии и политике",
          status: missingOperator.length === 0 ? "ok" : "todo",
          hint:
            missingOperator.length === 0
              ? "Видны в /soglasie и /privacy."
              : `Не заданы: ${missingOperator.join(", ")} (переменные OPERATOR_* в Vercel).`,
        },
        {
          title: "Кому передаются заявки (PD_RECIPIENTS)",
          status: has(env, "PD_RECIPIENTS") ? "ok" : "todo",
          hint: has(env, "PD_RECIPIENTS")
            ? env.PD_RECIPIENTS!.trim()
            : "Сети и CRM, куда уходят заявки, — их нужно назвать в согласии.",
        },
        {
          title: "Уведомление Роскомнадзора об обработке персональных данных",
          status: "manual",
          hint: "Подаётся до начала сбора данных — на pd.rkn.gov.ru.",
        },
        {
          title: "Тексты согласия и политики проверены юристом",
          status: "manual",
          hint: "На сайте — шаблоны для MVP.",
        },
      ],
    },
    {
      title: "Трафик и аналитика",
      checks: [
        {
          title: "Аналитика (Яндекс Метрика или Plausible)",
          status:
            has(env, "NEXT_PUBLIC_YANDEX_METRIKA_ID") || has(env, "NEXT_PUBLIC_PLAUSIBLE_DOMAIN")
              ? "ok"
              : "todo",
          hint: "Без неё не видно, какие страницы и источники приносят заявки.",
        },
        {
          title: "Telegram: уведомления о заявках и канал изменений цен",
          status:
            has(env, "TELEGRAM_BOT_TOKEN") &&
            (has(env, "TELEGRAM_LEADS_CHAT_ID") || has(env, "TELEGRAM_CHANNEL_ID"))
              ? "ok"
              : "todo",
          optional: true,
          hint: "Бот от @BotFather, переменные TELEGRAM_* (DEPLOY.md).",
        },
        {
          title: "Яндекс Вебмастер и Google Search Console",
          status: "manual",
          hint: `Добавьте сайт и отправьте карту сайта: ${siteOk ? site : "https://ваш-домен"}/sitemap.xml.`,
        },
      ],
    },
  ];
}

/** «Готово N из M»: обязательные пункты — всё, кроме «по желанию» и «проверьте сами». */
export function launchProgress(groups: LaunchGroup[]): { done: number; total: number } {
  const required = groups
    .flatMap((g) => g.checks)
    .filter((c) => !c.optional && c.status !== "manual");
  return { done: required.filter((c) => c.status === "ok").length, total: required.length };
}

/** «Покрытие из сида: 171 запись в 3 городах, демо-тарифов не из прайса: 49.» */
export function demoSummary(d: DemoCounts): string {
  return (
    `Покрытие из сида: ${d.coverage} ${plural(d.coverage, "запись", "записи", "записей")} ` +
    `в ${d.cities} ${plural(d.cities, "городе", "городах", "городах")}, ` +
    `демо-тарифов не из прайса: ${d.plans}.`
  );
}
