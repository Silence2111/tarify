/**
 * Сколько стоит заявка и сколько можно платить за трафик.
 *
 * ## Чего не было
 *
 * В админке считается выручка (сумма `payoutRub` по подтверждённым) и аппрув
 * (доля `CONFIRMED` среди закрытых). Обе цифры верные — и обе про прошлое.
 * Ни одна не отвечает на вопрос, который решается каждый день: **сколько
 * можно заплатить за визит и за заявку, чтобы не работать в минус**.
 *
 * Ответ был посчитан — в `research/build_report_phase2.py` и в отчёте
 * «Фаза 2: юнит-экономика». Но он лежит в Word-документе, а не в продукте:
 * оператор, который откручивает рекламу, его не видит. Между тем вывод
 * там резкий: заявка в платном трафике стоит 270–407 ₽ при доходе с заявки
 * около 600 ₽, то есть платный трафик едва окупается, и весь бизнес —
 * это SEO.
 *
 * ## Что здесь считается
 *
 * Та же воронка, но от **фактического** аппрува из базы, а не от оценки
 * из отчёта. Пока подтверждённых подключений мало, фактический аппрув
 * ничего не значит — на этот случай есть явная пометка `reliable: false`
 * и откат на оценку из исследования.
 *
 * Числа по умолчанию — из отчёта:
 *
 * | Шаг | Оценка | Откуда |
 * |---|---|---|
 * | визит → заявка | ~4% (2–6%) | бенчмарк услуг, интент по адресу выше |
 * | заявка → подключение | ~30% (25–40%) | белые лид-офферы с КЦ минус техотказы |
 * | выплата за подключение | ~2 000 ₽ | Ростелеком 1000/1500/2000 ₽ за 1/2/3 услуги |
 * | стоимость заявки в платном | 270–407 ₽ | замер по смежным нишам |
 */

/** Оценки из `research/` — используются, пока своей статистики мало. */
export const BENCHMARK = {
  /** Визит → заявка. */
  visitToLead: 0.04,
  /** Заявка → подтверждённое подключение. */
  leadToConnection: 0.3,
  /** Средняя выплата за подключение, ₽. */
  payoutRub: 2000,
  /** Во что обходится заявка в платном трафике, ₽ (нижняя и верхняя граница). */
  paidLeadCostRub: [270, 407] as const,
} as const;

/**
 * Сколько подтверждений нужно, чтобы верить своему аппруву.
 *
 * При пяти закрытых заявках доля «3 из 5» — это не 60% конверсии,
 * а случайность. Ниже порога считаем по бенчмарку и говорим об этом прямо.
 */
export const MIN_CLOSED_FOR_TRUST = 30;

/**
 * Какую долю дохода оставляем себе. Остальное — потолок расходов на трафик.
 * 0,4 означает: за заявку платим не больше 60% от того, что она приносит.
 */
export const TARGET_MARGIN = Number(process.env.TARGET_MARGIN ?? 0.4);

export type Funnel = {
  /** Доля закрытых заявок, ставших подключением. */
  approval: number;
  /** Считаем ли мы этот аппрув своим или берём бенчмарк. */
  reliable: boolean;
  /** Сколько закрытых заявок стоит за цифрой. */
  closed: number;
  /** Средняя выплата за подтверждённое подключение, ₽. */
  avgPayoutRub: number;
  /** Доход с одной заявки, ₽ (EPL). */
  revenuePerLead: number;
  /** Потолок цены заявки при целевой марже, ₽. */
  maxLeadCostRub: number;
  /** Доход с одного визита, ₽ (EPC). */
  revenuePerVisit: number;
  /** Потолок цены визита, ₽. */
  maxVisitCostRub: number;
  /**
   * Что с платным трафиком:
   * - `yes` — потолок выше самой дорогой заявки, реклама точно окупается;
   * - `edge` — потолок внутри вилки: окупается только на дешёвом трафике;
   * - `no` — потолок ниже самой дешёвой заявки, реклама в минус.
   */
  paidTraffic: "yes" | "edge" | "no";
  /** Совместимость: окупается хотя бы на дешёвом трафике. */
  paidTrafficWorks: boolean;
};

export type FunnelInput = {
  /** Подтверждённые подключения. */
  confirmed: number;
  /** Отказы. */
  rejected: number;
  /** Сумма выплат по подтверждённым, ₽. */
  revenueRub: number;
  /** Конверсия визита в заявку, если измерена. */
  visitToLead?: number;
};

/**
 * Разбор воронки в деньги.
 *
 * Считает от своих данных там, где их достаточно, и от бенчмарка там,
 * где нет. Что именно использовано — видно по `reliable`.
 */
export function funnel(input: FunnelInput): Funnel {
  const closed = Math.max(0, input.confirmed) + Math.max(0, input.rejected);
  const reliable = closed >= MIN_CLOSED_FOR_TRUST && input.confirmed > 0;

  const approval = reliable ? input.confirmed / closed : BENCHMARK.leadToConnection;

  // Среднюю выплату берём свою, только если есть с чего считать.
  const avgPayoutRub =
    input.confirmed > 0 && input.revenueRub > 0
      ? input.revenueRub / input.confirmed
      : BENCHMARK.payoutRub;

  const visitToLead = input.visitToLead ?? BENCHMARK.visitToLead;

  const revenuePerLead = approval * avgPayoutRub;
  const maxLeadCostRub = revenuePerLead * (1 - TARGET_MARGIN);
  const revenuePerVisit = revenuePerLead * visitToLead;
  const maxVisitCostRub = revenuePerVisit * (1 - TARGET_MARGIN);

  const [low, high] = BENCHMARK.paidLeadCostRub;
  const paidTraffic: Funnel["paidTraffic"] =
    maxLeadCostRub >= high ? "yes" : maxLeadCostRub >= low ? "edge" : "no";

  return {
    approval,
    reliable,
    closed,
    avgPayoutRub: Math.round(avgPayoutRub),
    revenuePerLead: Math.round(revenuePerLead),
    maxLeadCostRub: Math.round(maxLeadCostRub),
    revenuePerVisit: Math.round(revenuePerVisit * 100) / 100,
    maxVisitCostRub: Math.round(maxVisitCostRub * 100) / 100,
    paidTraffic,
    paidTrafficWorks: paidTraffic !== "no",
  };
}

/** Фраза для админки: что делать с этими числами. */
export function advice(f: Funnel): string {
  const [low, high] = BENCHMARK.paidLeadCostRub;
  const основа = f.reliable
    ? `Аппрув ${(f.approval * 100).toFixed(0)}% по ${f.closed} закрытым заявкам.`
    : `Закрытых заявок ${f.closed} — мало, чтобы верить своему аппруву. ` +
      `Считаем по оценке из исследования: ${(BENCHMARK.leadToConnection * 100).toFixed(0)}%.`;

  const деньги =
    `Заявка приносит ${f.revenuePerLead} ₽, платить за неё можно ` +
    `до ${f.maxLeadCostRub} ₽, за визит — до ${f.maxVisitCostRub} ₽.`;

  const вывод =
    f.paidTraffic === "yes"
      ? `Платный трафик окупается: заявка в рекламе стоит ${low}–${high} ₽, ` +
        `а платить можно до ${f.maxLeadCostRub} ₽.`
      : f.paidTraffic === "edge"
        ? `Платный трафик на грани: заявка в рекламе стоит ${low}–${high} ₽, ` +
          `а потолок ${f.maxLeadCostRub} ₽ — окупится только дешёвый трафик. ` +
          `Основной рост — органика.`
        : `Платный трафик не проходит: заявка в рекламе стоит ${low}–${high} ₽, ` +
          `а платить можно только ${f.maxLeadCostRub} ₽. Расти надо органикой.`;

  return `${основа} ${деньги} ${вывод}`;
}

/**
 * Сколько визитов нужно на заданный доход в месяц.
 * Обратная задача: не «сколько мы заработали», а «сколько надо трафика».
 */
export function visitsForRevenue(targetRub: number, f: Funnel): number {
  if (f.revenuePerVisit <= 0) return Infinity;
  return Math.ceil(targetRub / f.revenuePerVisit);
}
