// Цели аналитики из клиентского кода: Яндекс Метрика (reachGoal) и Plausible
// (свои события). Если счётчики не подключены, вызов ничего не делает.

type AnalyticsWindow = Window & {
  ym?: (id: number, method: string, ...args: unknown[]) => void;
  plausible?: (event: string) => void;
};

/** Номер счётчика Метрики из NEXT_PUBLIC_YANDEX_METRIKA_ID; null — Метрика выключена. */
export function metrikaId(): number | null {
  const id = Number(process.env.NEXT_PUBLIC_YANDEX_METRIKA_ID);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Цель: lead — заявка отправлена; partner_click — нажали «Оформить» (переход на сайт
 * оператора). Так в Метрике видно, какие страницы и источники приносят деньги.
 */
export function trackGoal(goal: "lead" | "partner_click"): void {
  if (typeof window === "undefined") return;
  const w = window as AnalyticsWindow;
  const id = metrikaId();
  if (id) w.ym?.(id, "reachGoal", goal);
  w.plausible?.(goal);
}
